package storeauth

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/armon/go-radix"
	"github.com/grafana/grafana/pkg/infra/filestorage"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
)

type radixTrees struct {
	allow *radix.Tree
	deny  *radix.Tree
}

func createTrees(prefix string, action string, user *models.SignedInUser, allowScope string, denyScope string) (*radixTrees, error) {
	if user == nil || user.Permissions == nil || user.Permissions[user.OrgId] == nil {
		denyTree := radix.New()
		denyTree.Insert("/", "*")
		return &radixTrees{
			allow: nil,
			deny:  denyTree,
		}, errors.New("missing permissions")
	}

	allowedPathPatterns := make([]string, 0)
	deniedPathPatterns := make([]string, 0)
	allowAll := false
	denyAll := false

	for _, scope := range user.Permissions[user.OrgId][action] {
		path := parsePath(scope)
		if strings.HasPrefix(scope, denyScope) {
			deniedPathPatterns = append(deniedPathPatterns, strings.TrimPrefix(path, "!"))
		} else if strings.HasPrefix(scope, allowScope) {
			allowedPathPatterns = append(allowedPathPatterns, path)
		} else if scope == ac.ScopeFilesAllowAll {
			allowAll = true
		} else if scope == ac.ScopeFilesDenyAll {
			denyAll = true
		} else {
			fmt.Println("unrecognized scope")
		}
	}

	if denyAll {
		denyTree := radix.New()
		denyTree.Insert("/", "*")
		return &radixTrees{
			allow: nil,
			deny:  denyTree,
		}, nil
	}

	denyTree := radix.New()

	for _, denied := range deniedPathPatterns {
		if strings.HasSuffix(denied, "*") {
			disallowedPrefix := strings.TrimPrefix(strings.TrimPrefix(strings.TrimSuffix(denied, "*"), "!"), prefix)
			denyTree.Insert(disallowedPrefix, "*")
		} else {
			disallowedPath := strings.TrimPrefix(strings.TrimPrefix(denied, "!"), prefix)
			denyTree.Insert(disallowedPath, "")
		}
	}

	if allowAll {
		allowTree := radix.New()
		allowTree.Insert("/", "*")

		return &radixTrees{
			allow: allowTree,
			deny:  denyTree,
		}, nil
	}

	allowTree := radix.New()
	for _, allowed := range allowedPathPatterns {

		if strings.HasSuffix(allowed, "*") {
			allowedPrefix := strings.TrimPrefix(strings.TrimSuffix(allowed, "*"), prefix)

			isDenied := false
			denyTree.WalkPath(allowedPrefix, func(s string, v interface{}) bool {
				if v == "*" {
					isDenied = true
					return true
				}
				return false
			})

			if isDenied {
				continue
			}

			for _, p := range pathWithPrecedingFolders(allowedPrefix) {
				allowTree.Insert(p, "")
			}
			allowTree.Insert(allowedPrefix, "*")
		} else {
			allowedPath := strings.TrimPrefix(allowed, prefix)

			isDenied := false
			denyTree.WalkPath(allowedPath, func(s string, v interface{}) bool {
				if v == "*" || s == allowedPath {
					isDenied = true
					return true
				}
				return false
			})

			if isDenied {
				continue
			}

			for _, p := range pathWithPrecedingFolders(allowedPath) {
				allowTree.Insert(p, "")
			}
		}
	}

	return &radixTrees{
		allow: allowTree,
		deny:  denyTree,
	}, nil
}

func (t *radixTrees) IsAllowed(path string) bool {
	denied := false
	t.deny.WalkPath(path, func(s string, v interface{}) bool {
		if v == "*" || s == path {
			denied = true
			return true
		}
		return false
	})

	if denied {
		return false
	}

	allowed := false
	t.allow.WalkPath(path, func(s string, v interface{}) bool {
		if v == "*" || s == path {
			allowed = true
			return true
		}
		return false
	})
	return allowed
}

func NewRadixTreeStorageAuthService() StorageAuthService {
	return &radixTreeStorageAuthService{
		log: log.New("radixTreeStorageAuthService"),
	}
}

type radixTreeStorageAuthService struct {
	log log.Logger
}

func (a *radixTreeStorageAuthService) NewGuardian(ctx context.Context, user *models.SignedInUser, storagePrefix string) FilesGuardian {
	readTrees, _ := createTrees(storagePrefix, ac.ActionFilesRead, user, allowFileScope(storagePrefix), denyFileScope(storagePrefix))
	writeTrees, _ := createTrees(storagePrefix, ac.ActionFilesWrite, user, allowFileScope(storagePrefix), denyFileScope(storagePrefix))
	return &radixTreeFileGuardian{
		ctx:           ctx,
		user:          user,
		log:           a.log,
		storagePrefix: strings.TrimPrefix(storagePrefix, filestorage.Delimiter),
		readTrees:     readTrees,
		writeTrees:    writeTrees,
	}
}

type radixTreeFileGuardian struct {
	ctx           context.Context
	user          *models.SignedInUser
	storagePrefix string
	ac            ac.AccessControl
	readTrees     *radixTrees
	writeTrees    *radixTrees
	log           log.Logger
}

func (a *radixTreeFileGuardian) GetSavePathFilters() *filestorage.PathFilters {
	return nil
}

func (a *radixTreeFileGuardian) GetViewPathFilters() *filestorage.PathFilters {
	return nil
}

func (a *radixTreeFileGuardian) CanSave(path string) bool {
	return a.writeTrees.IsAllowed(strings.TrimPrefix(path, a.storagePrefix))
}

func (a *radixTreeFileGuardian) CanView(path string) bool {
	return a.readTrees.IsAllowed(strings.TrimPrefix(path, a.storagePrefix))
}

func (a *radixTreeFileGuardian) can(action string, path string) bool {
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
