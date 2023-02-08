package sync

import (
	"context"

	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util/errutil"
)

var errFetchingSignedInUser = errutil.NewBase(errutil.StatusInternal, "user.sync.fetch", errutil.WithPublicMessage("Insufficient information to authenticate user"))

func ProvideFetchUserSync(service user.Service) *FetchUserSync {
	return &FetchUserSync{service}
}

type FetchUserSync struct {
	userService user.Service
}

func (s *FetchUserSync) FetchSyncedUserHook(ctx context.Context, identity *authn.Identity, r *authn.Request) error {
	if !identity.ClientParams.FetchSyncedUser {
		return nil
	}
	namespace, id := identity.NamespacedID()
	if namespace != authn.NamespaceUser {
		return nil
	}

	usr, err := s.userService.GetSignedInUserWithCacheCtx(ctx, &user.GetSignedInUserQuery{
		UserID: id,
		OrgID:  r.OrgID,
	})
	if err != nil {
		return errFetchingSignedInUser.Errorf("failed to resolve user: %w", err)
	}

	syncSignedInUserToIdentity(usr, identity)
	return nil
}

func syncSignedInUserToIdentity(usr *user.SignedInUser, identity *authn.Identity) {
	identity.Name = usr.Name
	identity.Login = usr.Login
	identity.Email = usr.Email
	identity.OrgID = usr.OrgID
	identity.OrgName = usr.OrgName
	identity.OrgCount = usr.OrgCount
	identity.OrgRoles = map[int64]org.RoleType{identity.OrgID: usr.OrgRole}
	identity.HelpFlags1 = usr.HelpFlags1
	identity.Teams = usr.Teams
	identity.LastSeenAt = usr.LastSeenAt
	identity.IsDisabled = usr.IsDisabled
	identity.IsGrafanaAdmin = &usr.IsGrafanaAdmin
}
