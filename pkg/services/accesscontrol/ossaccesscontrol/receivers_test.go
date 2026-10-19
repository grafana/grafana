package ossaccesscontrol

import (
	"context"
	"errors"
	"testing"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/iam"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/accesscontrol/database"
	"github.com/grafana/grafana/pkg/services/accesscontrol/permreg"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/authz/rbac/legacypermissions"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationCopyReceiverPermissionsRefreshAfterCommit(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	for _, legacy := range []bool{false, true} {
		name := "local"
		if legacy {
			name = "legacy RPC"
		}
		t.Run(name, func(t *testing.T) {
			evaluate := func(_ memprovider.InMemoryFlag, ctx openfeature.FlattenedContext) (any, openfeature.ProviderResolutionDetail) {
				return ctx["legacy-route"] == true, openfeature.ProviderResolutionDetail{}
			}
			require.NoError(t, openfeature.SetProviderAndWait(memprovider.NewInMemoryProvider(map[string]memprovider.InMemoryFlag{
				featuremgmt.FlagAuthzLegacyUserPermissions: {State: memprovider.Enabled, ContextEvaluator: &evaluate},
			})))
			t.Cleanup(func() { require.NoError(t, openfeature.SetProviderAndWait(openfeature.NoopProvider{})) })
			for _, rollback := range []bool{false, true} {
				name := "commit"
				if rollback {
					name = "rollback"
				}
				t.Run(name, func(t *testing.T) {
					ctx := openfeature.WithTransactionContext(t.Context(), openfeature.NewEvaluationContext("", map[string]any{"legacy-route": legacy}))
					sql := sqlstore.NewTestStore(t)
					cfg := setting.NewCfg()
					cfg.RBAC.PermissionCache = true
					features := featuremgmt.WithFeatures()
					actions := resourcepermissions.NewActionSetService()
					cache := localcache.New(0, 0)
					license := &licensing.OSSLicensingService{}
					catalog := legacypermissions.NewRoleCatalog()
					client := legacypermissions.NewEmbeddedClient(legacypermissions.NewLoader(sql, catalog, actions, cache, cfg, features, license, nil), cfg)
					var store accesscontrol.Store = database.ProvideService(sql)
					if legacy {
						store = actest.FakeStore{ExpectedErr: errors.New("local permission enumeration must not run")}
					}
					ac := acimpl.ProvideOSSService(cfg, store, actions, cache, features,
						tracing.InitializeTracerForTest(), sql, permreg.ProvidePermissionRegistry(), nil, iam.Features{}, client, catalog)
					recorder := &permissionRefreshRecorder{Service: ac, t: t}
					receivers, err := ProvideReceiverPermissionsService(cfg, features, routing.NewRouteRegister(), sql,
						actest.FakeAccessControl{ExpectedEvaluate: true}, iam.Features{}, license, recorder, nil, nil, nil, actions)
					require.NoError(t, err)
					requester := &user.SignedInUser{UserID: 7, UserUID: "seven", OrgID: 1, OrgRole: org.RoleViewer}
					_, err = receivers.SetPermissions(t.Context(), 1, "old", accesscontrol.SetResourcePermissionCommand{
						BuiltinRole: string(org.RoleViewer), Permission: string(models.PermissionView),
					})
					require.NoError(t, err)
					oldGrant := accesscontrol.Permission{Action: accesscontrol.ActionAlertingReceiversRead, Scope: "receivers:uid:old"}
					newGrant := accesscontrol.Permission{Action: accesscontrol.ActionAlertingReceiversRead, Scope: "receivers:uid:new"}
					permissions, err := ac.GetUserPermissions(ctx, requester, accesscontrol.Options{})
					require.NoError(t, err)
					require.Contains(t, permissions, oldGrant)
					rollbackErr := errors.New("rollback")
					err = sql.InTransaction(ctx, func(ctx context.Context) error {
						_, err := receivers.CopyPermissions(ctx, 1, requester, "old", "new")
						require.NoError(t, err)
						require.NoError(t, receivers.DeleteResourcePermissions(ctx, 1, "old"))
						require.Zero(t, recorder.calls)
						if rollback {
							return rollbackErr
						}
						return nil
					})
					if rollback {
						require.ErrorIs(t, err, rollbackErr)
						require.Zero(t, recorder.calls)
					} else {
						require.NoError(t, err)
						require.Equal(t, 1, recorder.calls)
					}
					permissions, err = ac.GetUserPermissions(ctx, requester, accesscontrol.Options{})
					require.NoError(t, err)
					if rollback {
						require.Contains(t, permissions, oldGrant)
						require.NotContains(t, permissions, newGrant)
					} else {
						require.Contains(t, permissions, newGrant)
						require.NotContains(t, permissions, oldGrant)
					}
				})
			}
		})
	}
}

type permissionRefreshRecorder struct {
	accesscontrol.Service
	t     *testing.T
	calls int
}

func (r *permissionRefreshRecorder) GetUserPermissions(ctx context.Context, user identity.Requester, options accesscontrol.Options) ([]accesscontrol.Permission, error) {
	r.calls++
	require.Nil(r.t, ctx.Value(sqlstore.ContextSessionKey{}))
	require.True(r.t, options.ReloadCache)
	return r.Service.GetUserPermissions(ctx, user, options)
}
