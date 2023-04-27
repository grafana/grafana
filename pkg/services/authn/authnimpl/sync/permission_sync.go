package sync

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/util/errutil"
)

var (
	errSyncPermissionsForbidden = errutil.NewBase(errutil.StatusForbidden, "permissions.sync.forbidden")
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
	if s.ac.IsDisabled() || !identity.ClientParams.SyncPermissions {
		return nil
	}

	permissions, err := s.ac.GetUserPermissions(ctx, identity.SignedInUser(),
		accesscontrol.Options{ReloadCache: false})
	if err != nil {
		s.log.FromContext(ctx).Error("failed to fetch permissions from db", "error", err, "user_id", identity.ID)
		return errSyncPermissionsForbidden
	}

	if identity.Permissions == nil {
		identity.Permissions = make(map[int64]map[string][]string)
	}
	identity.Permissions[identity.OrgID] = accesscontrol.GroupScopesByAction(permissions)
	return nil
}
