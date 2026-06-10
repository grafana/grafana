package authz

import (
	"context"

	authlib "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/setting"
)

// newExternalGroupsAccessClient decorates an AccessClient so that, when
// id_use_external_groups_for_groups_claim is set, the contextual team-membership
// tuples the forward authz path derives from AuthInfo.GetGroups() come from the
// IdP/proxy-supplied external groups (external group names match team UIDs) instead
// of Grafana-stored team memberships.
//
// This is the authz-boundary alternative to setting Identity.Groups during authn:
// it confines the flag handling to the forward Check/Compile/BatchCheck path without
// changing the identity seen by the rest of the system. When the flag is off it is a
// no-op and returns the inner client unchanged (preserving any wider interface it
// implements, e.g. zanzana.Client).
func newExternalGroupsAccessClient(cfg *setting.Cfg, inner authlib.AccessClient) authlib.AccessClient {
	if cfg == nil || !cfg.IDUseExternalGroupsForGroupsClaim {
		return inner
	}
	return &externalGroupsAccessClient{inner: inner}
}

type externalGroupsAccessClient struct {
	inner authlib.AccessClient
}

// swap returns an AuthInfo whose GetGroups() yields the identity's external groups,
// leaving every other AuthInfo method delegated to the original.
func (c *externalGroupsAccessClient) swap(info authlib.AuthInfo) authlib.AuthInfo {
	r, ok := info.(identity.Requester)
	if !ok {
		return info
	}
	ext := r.GetExternalGroups()
	if len(ext) == 0 {
		return info
	}
	return externalGroupsAuthInfo{AuthInfo: info, groups: ext}
}

func (c *externalGroupsAccessClient) Check(ctx context.Context, info authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
	return c.inner.Check(ctx, c.swap(info), req, folder)
}

func (c *externalGroupsAccessClient) Compile(ctx context.Context, info authlib.AuthInfo, req authlib.ListRequest) (authlib.ItemChecker, authlib.Zookie, error) {
	return c.inner.Compile(ctx, c.swap(info), req)
}

func (c *externalGroupsAccessClient) BatchCheck(ctx context.Context, info authlib.AuthInfo, req authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
	return c.inner.BatchCheck(ctx, c.swap(info), req)
}

// externalGroupsAuthInfo overrides GetGroups() to return external groups while
// delegating all other AuthInfo methods to the embedded value.
type externalGroupsAuthInfo struct {
	authlib.AuthInfo
	groups []string
}

func (e externalGroupsAuthInfo) GetGroups() []string { return e.groups }
