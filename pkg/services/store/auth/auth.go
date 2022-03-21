package storeauth

import (
	"context"
	"errors"
	"strings"

	"github.com/grafana/grafana/pkg/infra/filestorage"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
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

		if path == ac.ScopeFilesAllowAll {
			allowedPrefixes = append(allowedPrefixes, filestorage.Delimiter)
		}

		if path == ac.ScopeFilesDenyAll {
			allowedPrefixes = append(allowedPrefixes, filestorage.Delimiter)
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

func NewStorageAuthService() StorageAuthService {
	return &storageAuthService{
		log: log.New("storageAuthService"),
	}
}

type storageAuthService struct {
	log log.Logger
}

func (a *storageAuthService) createPathFilters(ctx context.Context, action string, user *models.SignedInUser, path string) *filestorage.PathFilters {
	p, err := createPathFilters(path, action, user, allowFileScope(path), denyFileScope(path))

	if err != nil {
		a.log.Error("Error when creating sql filters", "error", err)
		return denyAllFilters
	}

	return p
}

func (a *storageAuthService) NewGuardian(ctx context.Context, user *models.SignedInUser, storagePrefix string) FilesGuardian {
	readFilters := a.createPathFilters(ctx, ac.ActionFilesRead, user, storagePrefix)
	writeFilters := a.createPathFilters(ctx, ac.ActionFilesWrite, user, storagePrefix)
	return &filesGuardian{
		ctx:           ctx,
		user:          user,
		log:           a.log,
		storagePrefix: strings.TrimPrefix(storagePrefix, filestorage.Delimiter),
		readFilters:   readFilters,
		writeFilters:  writeFilters,
	}
}

type filesGuardian struct {
	ctx           context.Context
	user          *models.SignedInUser
	storagePrefix string
	ac            ac.AccessControl
	readFilters   *filestorage.PathFilters
	writeFilters  *filestorage.PathFilters
	log           log.Logger
}

func (a *filesGuardian) GetSavePathFilters() *filestorage.PathFilters {
	return a.writeFilters
}

func (a *filesGuardian) GetViewPathFilters() *filestorage.PathFilters {
	return a.readFilters
}

func (a *filesGuardian) CanSave(path string) bool {
	return a.writeFilters.IsAllowed(strings.TrimPrefix(path, a.storagePrefix))
}

func (a *filesGuardian) CanView(path string) bool {
	return a.readFilters.IsAllowed(strings.TrimPrefix(path, a.storagePrefix))
}

func (a *filesGuardian) can(action string, path string) bool {
	var allow bool
	switch action {
	case ac.ActionFilesCreate:
		fallthrough
	case ac.ActionFilesWrite:
		fallthrough
	case ac.ActionFilesDelete:
		allow = a.CanSave(path)
	case ac.ActionFilesRead:
		allow = a.CanView(path)
	default:
		storeAuthMainLogger.Warn("Unsupported action", "action", action, "path", path)
		allow = false
	}

	if !allow {
		a.log.Warn("denying", "action", action, "path", path)
	}
	return allow
}

func allowFileScope(path string) string {
	return ac.Scope("files", "path", path)
}

func denyFileScope(path string) string {
	return ac.Scope("files", "path", "!"+path)
}

func isDenyFileScope(scope string) bool {
	return strings.HasPrefix(scope, "files:path:!")
}

func addPrefixToFileScope(scope string, prefix string) string {
	path := parsePath(scope)
	if isDenyFileScope(scope) {
		return denyFileScope(filestorage.Join(prefix, strings.TrimPrefix(path, "!")))
	}

	return allowFileScope(filestorage.Join(prefix, path))
}

func fileScope(path string) string {
	return ac.Scope("files", "path", path)
}
