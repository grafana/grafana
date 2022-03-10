package store

import (
	"context"
	"errors"
	"strings"

	"github.com/grafana/grafana/pkg/infra/filestorage"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

var (
	denyAllFilters  = filestorage.NewPathFilters([]string{}, nil, nil, nil)
	allowAllFilters = filestorage.NewPathFilters(nil, nil, nil, nil)
)

func pathWithPrecedingFolders(path string) []string {
	parts := strings.Split(path, filestorage.Delimiter)

	res := make([]string, 0)
	acc := filestorage.Delimiter
	res = append(res, acc)
	for i := 1; i < len(parts); i++ {
		acc = filestorage.Join(acc, parts[i])
		if i != len(parts)-1 {
			acc += filestorage.Delimiter
		}
		res = append(res, acc)
	}

	return res
}

func createPathFilters(prefix string, action string, user *models.SignedInUser, allowScope string, denyScope string) (*filestorage.PathFilters, error) {
	if user == nil || user.Permissions == nil || user.Permissions[user.OrgId] == nil {
		return denyAllFilters, errors.New("missing permissions")
	}

	allowedPrefixes := make([]string, 0)
	allowedPaths := make([]string, 0)
	var disallowedPaths []string
	var disallowedPrefixes []string
	for _, scope := range user.Permissions[user.OrgId][action] {
		path := parsePath(scope)

		if path == "/*" {
			allowedPrefixes = append(allowedPrefixes, "/")
		}

		if strings.HasPrefix(scope, denyScope) {
			if strings.HasSuffix(scope, "*") {
				disallowedPrefix := strings.TrimPrefix(strings.TrimPrefix(strings.TrimSuffix(path, "*"), "!"), prefix)
				disallowedPrefixes = append(disallowedPrefixes, disallowedPrefix)
			} else {
				disallowedPath := strings.TrimPrefix(strings.TrimPrefix(path, "!"), prefix)
				disallowedPaths = append(disallowedPaths, disallowedPath)
			}
		} else if strings.HasPrefix(scope, allowScope) {
			if strings.HasSuffix(scope, "*") {
				allowedPrefix := strings.TrimPrefix(strings.TrimSuffix(path, "*"), prefix)
				allowedPrefixes = append(allowedPrefixes, allowedPrefix)
				allowedPaths = append(allowedPaths, pathWithPrecedingFolders(allowedPrefix)...)
			} else {
				allowedPath := strings.TrimPrefix(path, prefix)
				allowedPaths = append(allowedPaths, pathWithPrecedingFolders(allowedPath)...)
			}
		}
	}

	filters := filestorage.NewPathFilters(allowedPrefixes, allowedPaths, disallowedPrefixes, disallowedPaths)
	return filters, nil
}

func parsePath(scope string) string {
	return scope[strings.LastIndex(scope, ":")+1:]
}

type StorageAuthService interface {
	newGuardian(ctx context.Context, user *models.SignedInUser, path string) FilesGuardian
}

type FilesGuardian interface {
	canView(path string) bool
	canSave(path string) bool

	getViewPathFilters() *filestorage.PathFilters
	getSavePathFilters() *filestorage.PathFilters
}

func NewStorageAuthService(ac accesscontrol.AccessControl, permissionsServices accesscontrol.PermissionsServices) StorageAuthService {
	return &storageAuthService{
		log:                 log.New("storageAuthService"),
		ac:                  ac,
		permissionsServices: permissionsServices,
	}
}

type storageAuthService struct {
	log                 log.Logger
	ac                  accesscontrol.AccessControl
	permissionsServices accesscontrol.PermissionsServices
}

func (a *storageAuthService) createPathFilters(ctx context.Context, action string, user *models.SignedInUser, path string) *filestorage.PathFilters {
	p, err := createPathFilters(path, action, user, fileScope(path), fileScope("!"+path))

	if err != nil {
		a.log.Error("Error when creating sql filters", "error", err)
		return denyAllFilters
	}

	return p
}

func (a *storageAuthService) newGuardian(ctx context.Context, user *models.SignedInUser, storagePrefix string) FilesGuardian {
	readFilters := a.createPathFilters(ctx, accesscontrol.ActionFilesRead, user, storagePrefix)
	writeFilters := a.createPathFilters(ctx, accesscontrol.ActionFilesWrite, user, storagePrefix)
	return &filesGuardian{
		ctx:                ctx,
		user:               user,
		ac:                 a.ac,
		storagePrefix:      strings.TrimPrefix(storagePrefix, filestorage.Delimiter),
		permissionServices: a.permissionsServices,
		readFilters:        readFilters,
		writeFilters:       writeFilters,
	}
}

type filesGuardian struct {
	ctx                context.Context
	user               *models.SignedInUser
	storagePrefix      string
	ac                 accesscontrol.AccessControl
	permissionServices accesscontrol.PermissionsServices
	readFilters        *filestorage.PathFilters
	writeFilters       *filestorage.PathFilters
}

func (a *filesGuardian) getSavePathFilters() *filestorage.PathFilters {
	return a.writeFilters
}

func (a *filesGuardian) getViewPathFilters() *filestorage.PathFilters {
	return a.readFilters
}

func (a *filesGuardian) canSave(path string) bool {
	return a.writeFilters.IsAllowed(strings.TrimPrefix(path, a.storagePrefix))
}

func (a *filesGuardian) canView(path string) bool {
	return a.readFilters.IsAllowed(strings.TrimPrefix(path, a.storagePrefix))
}

func fileScope(path string) string {
	return accesscontrol.Scope("files", "path", path)
}
