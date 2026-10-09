package acimpl

import (
	"context"
	"fmt"
	"testing"

	"github.com/grafana/authlib/types"
	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/authz/legacyclient"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

type searchPermissionsClientFunc struct {
	legacyclient.Service
	search func(context.Context, types.AuthInfo, legacyclient.LegacySearchUsersPermissionsRequest) (legacyclient.LegacySearchUsersPermissionsResponse, error)
}

func (f searchPermissionsClientFunc) LegacySearchUsersPermissions(ctx context.Context, caller types.AuthInfo, req legacyclient.LegacySearchUsersPermissionsRequest) (legacyclient.LegacySearchUsersPermissionsResponse, error) {
	return f.search(ctx, caller, req)
}

func configureSearchFlags(t *testing.T, search, legacy bool) {
	t.Helper()
	flags := map[string]memprovider.InMemoryFlag{}
	for name, enabled := range map[string]bool{featuremgmt.FlagAuthzUserPermissionsSearch: search, featuremgmt.FlagAuthzLegacyUserPermissions: legacy} {
		flags[name] = memprovider.InMemoryFlag{State: memprovider.Enabled, Variants: map[string]any{"value": enabled}, DefaultVariant: "value"}
	}
	require.NoError(t, openfeature.SetProviderAndWait(memprovider.NewInMemoryProvider(flags)))
	t.Cleanup(func() { require.NoError(t, openfeature.SetProviderAndWait(openfeature.NoopProvider{})) })
}

func TestServiceSearchPermissionsClientFailureDoesNotFallBack(t *testing.T) {
	for _, configured := range []bool{false, true} {
		t.Run(map[bool]string{false: "missing capability", true: "RPC failure"}[configured], func(t *testing.T) {
			configureSearchFlags(t, true, false)
			service := &Service{cfg: setting.NewCfg(), store: actest.NewMockStore(t)}
			caller := &user.SignedInUser{OrgID: 1, UserID: 1, UserUID: "caller"}
			options := accesscontrol.SearchOptions{Action: "test:read"}
			calls := 0
			if configured {
				service.legacyClient = searchPermissionsClientFunc{search: func(_ context.Context, auth types.AuthInfo, req legacyclient.LegacySearchUsersPermissionsRequest) (legacyclient.LegacySearchUsersPermissionsResponse, error) {
					calls++
					require.Equal(t, "access-policy:embedded-grafana", auth.GetSubject())
					require.Equal(t, "default", req.Namespace)
					require.Equal(t, caller.GetIdentifier(), req.Caller.UID)
					require.Equal(t, options.Action, req.Action)
					return legacyclient.LegacySearchUsersPermissionsResponse{}, assert.AnError
				}}
			}
			result, err := service.SearchUsersPermissions(t.Context(), caller, options)
			require.Nil(t, result)
			if configured {
				require.ErrorIs(t, err, assert.AnError)
				require.Equal(t, 1, calls)
			} else {
				require.ErrorContains(t, err, "not configured")
			}
		})
	}
}

func TestServiceSearchFlagDoesNotChangeUserPermissionsRouting(t *testing.T) {
	for _, search := range []bool{false, true} {
		for _, legacy := range []bool{false, true} {
			for _, singleOrg := range []bool{false, true} {
				for _, apiEnabled := range []bool{false, true} {
					for _, orgID := range []int64{0, 2} {
						t.Run(fmt.Sprintf("search=%t/legacy=%t/singleOrg=%t/api=%t/org=%d", search, legacy, singleOrg, apiEnabled, orgID), func(t *testing.T) {
							configureSearchFlags(t, search, legacy)
							service := &Service{
								cfg: setting.NewCfg(), cache: localcache.ProvideService(), log: log.New("test"),
								store: &actest.FakeStore{}, roles: accesscontrol.BuildBasicRoleDefinitions(), features: featuremgmt.WithFeatures(),
								actionResolver: resourcepermissions.NewActionSetService(), legacyClient: &routingEnumerationClient{},
							}
							service.cfg.RBAC.SingleOrganization = singleOrg
							service.userPermissionsAPIEnabled = apiEnabled
							rpc := &fakeUserPermissionsClient{}
							service.SetUserPermissionsClient(rpc)
							caller := &user.SignedInUser{UserID: 1, UserUID: "caller", OrgID: orgID}
							_, err := service.GetUserPermissions(t.Context(), caller, accesscontrol.Options{})
							require.NoError(t, err)
							if !legacy && singleOrg && apiEnabled && orgID != 0 {
								require.Equal(t, 1, rpc.calls)
							} else {
								require.Zero(t, rpc.calls)
							}
						})
					}
				}
			}
		}
	}
}

type routingEnumerationClient struct{}

func (*routingEnumerationClient) LegacyGetUserPermissions(context.Context, types.AuthInfo, legacyclient.LegacyGetUserPermissionsRequest) (legacyclient.LegacyGetUserPermissionsResponse, error) {
	return legacyclient.LegacyGetUserPermissionsResponse{}, nil
}
