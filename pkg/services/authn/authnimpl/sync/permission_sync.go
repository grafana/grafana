package sync

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/util/errutil"
)

var (
	errSyncPermissionsForbidden = errutil.Forbidden("permissions.sync.forbidden")
)

func ProvidePermissionsSync(acService accesscontrol.Service) *PermissionsSync {
	return &PermissionsSync{
		ac:  acService,
		log: log.New("permissions.sync"),
	}
}

type PermissionsSync struct {
	ac  accesscontrol.Service
	log log.Logger
}

func (s *PermissionsSync) SyncPermissionsHook(ctx context.Context, identity *authn.Identity, _ *authn.Request) error {
	if !identity.ClientParams.SyncPermissions {
		return nil
	}

	permissions, err := s.ac.GetUserPermissions(ctx, identity.SignedInUser(),
		accesscontrol.Options{ReloadCache: false})
	if err != nil {
		s.log.FromContext(ctx).Error("Failed to fetch permissions from db", "error", err, "user_id", identity.ID)
		return errSyncPermissionsForbidden
	}

	if identity.Permissions == nil {
		identity.Permissions = make(map[int64]map[string][]string)
	}

	permissionsByAction := map[string][]string{}

	if len(identity.ClientParams.RestrictPermissions) > 0 {
		permissionsByAction = accesscontrol.Intersect(permissions, ungroupPermissions(identity.ClientParams.RestrictPermissions))
	} else {
		permissionsByAction = accesscontrol.GroupScopesByAction(permissions)
	}

	identity.Permissions[identity.OrgID] = permissionsByAction

	return nil
}

func ungroupPermissions(groupedPermissions map[string][]string) []accesscontrol.Permission {
	restrictSet := []accesscontrol.Permission{}
	for action, scopes := range groupedPermissions {
		for i := range scopes {
			restrictSet = append(restrictSet, accesscontrol.Permission{Action: action, Scope: scopes[i]})
		}
	}
	return restrictSet
}
