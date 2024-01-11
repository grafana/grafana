package sync

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/util/errutil"
)

var (
	errSyncPermissionsForbidden = errutil.Forbidden("permissions.sync.forbidden")
)

func ProvideRBACSync(acService accesscontrol.Service) *RBACSync {
	return &RBACSync{
		ac:  acService,
		log: log.New("permissions.sync"),
	}
}

type RBACSync struct {
	ac  accesscontrol.Service
	log log.Logger
}

func (s *RBACSync) SyncPermissionsHook(ctx context.Context, identity *authn.Identity, _ *authn.Request) error {
	if !identity.ClientParams.SyncPermissions {
		return nil
	}

	permissions, err := s.ac.GetUserPermissions(ctx, identity, accesscontrol.Options{ReloadCache: false})
	if err != nil {
		s.log.FromContext(ctx).Error("Failed to fetch permissions from db", "error", err, "user_id", identity.ID)
		return errSyncPermissionsForbidden
	}

	if identity.Permissions == nil {
		identity.Permissions = make(map[int64]map[string][]string)
	}
	identity.Permissions[identity.OrgID] = accesscontrol.GroupScopesByAction(permissions)
	return nil
}

func (s *RBACSync) SyncCloudRoles(ctx context.Context, identity *authn.Identity, r *authn.Request) error {
	// we only want to run this hook during login and if the module used is grafana com
	if r.GetMeta(authn.MetaKeyAuthModule) != login.GrafanaComAuthModule {
		return nil
	}

	return nil
}
