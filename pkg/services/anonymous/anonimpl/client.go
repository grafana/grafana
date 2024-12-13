package anonimpl

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"github.com/grafana/authlib/claims"
	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/anonymous"
	"github.com/grafana/grafana/pkg/services/anonymous/anonimpl/anonstore"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	errInvalidOrg  = errutil.Unauthorized("anonymous.invalid-org")
	errInvalidID   = errutil.Unauthorized("anonymous.invalid-id")
	errDeviceLimit = errutil.Unauthorized("anonymous.device-limit-reached", errutil.WithPublicMessage("Anonymous device limit reached. Contact Administrator"))
)

var (
	_ authn.ContextAwareClient     = new(Anonymous)
	_ authn.IdentityResolverClient = new(Anonymous)
)

type Anonymous struct {
	cfg               *setting.Cfg
	log               log.Logger
	orgService        org.Service
	anonDeviceService anonymous.Service
}

func (a *Anonymous) Name() string {
	return authn.ClientAnonymous
}

func (a *Anonymous) Authenticate(ctx context.Context, r *authn.Request) (*authn.Identity, error) {
	o, err := a.orgService.GetByName(ctx, &org.GetOrgByNameQuery{Name: a.cfg.AnonymousOrgName})
	if err != nil {
		a.log.FromContext(ctx).Error("Failed to find organization", "name", a.cfg.AnonymousOrgName, "error", err)
		return nil, err
	}

	httpReqCopy := &http.Request{}
	if r.HTTPRequest != nil && r.HTTPRequest.Header != nil {
		// avoid r.HTTPRequest.Clone(context.Background()) as we do not require a full clone
		httpReqCopy.Header = r.HTTPRequest.Header.Clone()
		httpReqCopy.RemoteAddr = r.HTTPRequest.RemoteAddr
	}

	if err := a.anonDeviceService.TagDevice(ctx, httpReqCopy, anonymous.AnonDeviceUI); err != nil {
		if errors.Is(err, anonstore.ErrDeviceLimitReached) {
			return nil, errDeviceLimit.Errorf("limit reached for anonymous devices: %w", err)
		}

		a.log.Warn("Failed to tag anonymous session", "error", err)
	}

	return a.newAnonymousIdentity(o), nil
}

func (a *Anonymous) IsEnabled() bool {
	return a.cfg.AnonymousEnabled
}

func (a *Anonymous) Test(ctx context.Context, r *authn.Request) bool {
	// If anonymous client is register it can always be used for authentication
	return true
}

func (a *Anonymous) IdentityType() claims.IdentityType {
	return claims.TypeAnonymous
}

func (a *Anonymous) ResolveIdentity(ctx context.Context, orgID int64, typ claims.IdentityType, id string) (*authn.Identity, error) {
	o, err := a.orgService.GetByName(ctx, &org.GetOrgByNameQuery{Name: a.cfg.AnonymousOrgName})
	if err != nil {
		return nil, err
	}

	if o.ID != orgID {
		return nil, errInvalidOrg.Errorf("anonymous user cannot authenticate in org %d", o.ID)
	}

	// Anonymous identities should always have the same namespace id.
	if !claims.IsIdentityType(typ, claims.TypeAnonymous) || id != "0" {
		return nil, errInvalidID
	}

	return a.newAnonymousIdentity(o), nil
}

func (a *Anonymous) UsageStatFn(ctx context.Context) (map[string]any, error) {
	m := map[string]any{}

	// Add stats about anonymous auth
	m["stats.anonymous.customized_role.count"] = 0
	if !strings.EqualFold(a.cfg.AnonymousOrgRole, "Viewer") {
		m["stats.anonymous.customized_role.count"] = 1
	}

	return m, nil
}

func (a *Anonymous) Priority() uint {
	return 100
}

func (a *Anonymous) newAnonymousIdentity(o *org.Org) *authn.Identity {
	return &authn.Identity{
		ID:           "0",
		Type:         claims.TypeAnonymous,
		OrgID:        o.ID,
		OrgName:      o.Name,
		OrgRoles:     map[int64]org.RoleType{o.ID: org.RoleType(a.cfg.AnonymousOrgRole)},
		ClientParams: authn.ClientParams{SyncPermissions: true},
	}
}
