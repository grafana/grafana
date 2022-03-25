package store

import (
	"context"
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/infra/filestorage"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
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

func createPathFilter(prefix string, action string, user *models.SignedInUser, allowScope string, denyScope string) (filestorage.PathFilter, error) {
	nilUser := user == nil
	nilPermissions := nilUser || user.Permissions == nil
	nilOrgPermissions := nilPermissions || user.Permissions[user.OrgId] == nil
	if nilOrgPermissions {
		return nil, fmt.Errorf("missing permissions. user is nil: %t, permissions are nil: %t, permissions for org are nil: %t", nilUser, nilPermissions, nilOrgPermissions)
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

	filters := filestorage.NewPathFilter(allowedPrefixes, allowedPaths, disallowedPrefixes, disallowedPaths)
	return filters, nil
}

func parsePath(scope string) string {
	return scope[strings.LastIndex(scope, ":")+1:]
}

func newAccessControlStorageAuthService() storageAuthService {
	return &accessControlStorageAuth{
		log: log.New("storageAuthService"),
	}
}

type accessControlStorageAuth struct {
	log log.Logger
}

func (a *accessControlStorageAuth) createPathFilters(action string, user *models.SignedInUser, path string) filestorage.PathFilter {
	p, err := createPathFilter(path, action, user, allowFileScope(path), denyFileScope(path))

	if err != nil {
		a.log.Error("Error when creating sql filters", "error", err)
		return filestorage.NewDenyAllPathFilter()
	}

	return p
}

func (a *accessControlStorageAuth) newGuardian(ctx context.Context, user *models.SignedInUser, storagePrefix string) fileGuardian {
	return &pathFilterFileGuardian{
		ctx:         ctx,
		user:        user,
		log:         a.log,
		storageName: strings.TrimPrefix(storagePrefix, filestorage.Delimiter),
		pathFilterByAction: map[string]filestorage.PathFilter{
			ac.ActionFilesRead:  a.createPathFilters(ac.ActionFilesRead, user, storagePrefix),
			ac.ActionFilesWrite: a.createPathFilters(ac.ActionFilesWrite, user, storagePrefix),
		},
	}
}
