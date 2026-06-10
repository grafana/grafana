package authz

import (
	"context"

	authlib "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/setting"
)

// newExternalGroupsAccessClient decorates an AccessClient so that, under
// id_use_external_groups_for_groups_claim, the forward authz path sources its contextual
// team membership from the identity's external groups instead of stored team memberships.
// No-op (returns inner unchanged) when the flag is off.
func newExternalGroupsAccessClient(cfg *setting.Cfg, inner authlib.AccessClient) authlib.AccessClient {
	if cfg == nil || !cfg.IDUseExternalGroupsForGroupsClaim {
		return inner
	}
	return &externalGroupsAccessClient{inner: inner}
}

type externalGroupsAccessClient struct {
	inner authlib.AccessClient
}

// swap returns an AuthInfo whose GetGroups() yields the external groups.
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

// externalGroupsAuthInfo overrides GetGroups() and delegates the rest.
type externalGroupsAuthInfo struct {
	authlib.AuthInfo
	groups []string
}

func (e externalGroupsAuthInfo) GetGroups() []string { return e.groups }
