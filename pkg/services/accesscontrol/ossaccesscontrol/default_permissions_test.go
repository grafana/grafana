package ossaccesscontrol

import (
	"context"
	"errors"
	"testing"

	claims "github.com/grafana/authlib/types"
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
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationDefaultPermissionsRefreshAfterCommit(t *testing.T) {
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
			for _, resource := range []string{"receiver", "route"} {
				for _, serviceAccount := range []bool{false, true} {
					for _, outcome := range []string{"commit", "rollback", "commit failure", "permission failure", "refresh failure", "standalone"} {
						identityType := "user"
						if serviceAccount {
							identityType = "service account"
						}
						t.Run(resource+"/"+identityType+"/"+outcome, func(t *testing.T) {
							ctx := openfeature.WithTransactionContext(t.Context(), openfeature.NewEvaluationContext("", map[string]any{"legacy-route": legacy}))
							sql := sqlstore.NewTestStore(t)
							ctx = context.WithValue(ctx, creatorContextKey{}, "owner")
							followingEvent := false
							sql.Bus().AddEventListener(func(context.Context, *creatorRefreshFollowingEvent) error {
								followingEvent = true
								return nil
							})
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
								store = actest.FakeStore{ExpectedErr: errors.New("local enumeration must not run")}
							}
							ac := acimpl.ProvideOSSService(cfg, store, actions, cache, features,
								tracing.InitializeTracerForTest(), sql, permreg.ProvidePermissionRegistry(), nil, iam.Features{}, client, catalog)
							requester := &user.SignedInUser{UserID: 1, UserUID: "creator", OrgID: 1, OrgRole: org.RoleViewer, IsServiceAccount: serviceAccount}
							failure := errors.New("failed")
							recorder := &creatorPermissionRecorder{Service: ac, t: t}
							if outcome == "refresh failure" {
								recorder.refreshErr = failure
							}
							users := &usertest.FakeUserService{ExpectedSignedInUser: requester}
							if outcome == "permission failure" {
								users.ExpectedError = failure
							}
							var setDefaults func(context.Context)
							grant := accesscontrol.Permission{Action: accesscontrol.ActionAlertingReceiversReadSecrets, Scope: "receivers:uid:new"}
							if resource == "receiver" {
								svc, err := ProvideReceiverPermissionsService(cfg, features, routing.NewRouteRegister(), sql,
									actest.FakeAccessControl{ExpectedEvaluate: true}, iam.Features{}, license, recorder, nil, users, nil, actions)
								require.NoError(t, err)
								setDefaults = func(ctx context.Context) { svc.SetDefaultPermissions(ctx, 1, requester, "new") }
							} else {
								svc, err := ProvideRoutePermissionsService(cfg, features, routing.NewRouteRegister(), sql,
									actest.FakeAccessControl{ExpectedEvaluate: true}, iam.Features{}, license, recorder, nil, users, nil, actions)
								require.NoError(t, err)
								setDefaults = func(ctx context.Context) {
									err := svc.SetDefaultPermissions(ctx, 1, requester, "new")
									if outcome == "permission failure" {
										require.ErrorIs(t, err, failure)
									} else {
										require.NoError(t, err)
									}
								}
								grant = accesscontrol.Permission{Action: accesscontrol.ActionAlertingRoutesPermissionsWrite, Scope: accesscontrol.AlertingNotificationsApiGroup + "/" + accesscontrol.AlertingRoutesResource + ":uid:new"}
							}
							// Populate both identity cache keys before the write.
							for _, sa := range []bool{false, true} {
								actor := *requester
								actor.IsServiceAccount = sa
								permissions, err := ac.GetUserPermissions(ctx, &actor, accesscontrol.Options{})
								require.NoError(t, err)
								require.NotContains(t, permissions, grant)
							}
							var err error
							if outcome == "standalone" {
								setDefaults(ctx)
							} else {
								err = sql.InTransaction(ctx, func(txCtx context.Context) error {
									require.NoError(t, sql.InTransaction(context.WithValue(txCtx, creatorContextKey{}, "inner"), func(ctx context.Context) error {
										setDefaults(ctx)
										sqlstore.SessionFromContext(ctx).PublishAfterCommit(&creatorRefreshFollowingEvent{})
										return nil
									}))
									require.Empty(t, recorder.calls, "no cache operations before the outermost commit")
									// A parallel request still sees the old cache before commit.
									permissions, err := ac.GetUserPermissions(ctx, requester, accesscontrol.Options{})
									require.NoError(t, err)
									require.NotContains(t, permissions, grant)
									if outcome == "rollback" {
										return failure
									}
									if outcome == "commit failure" {
										tx, err := sqlstore.SessionFromContext(txCtx).Tx()
										require.NoError(t, err)
										require.NoError(t, tx.Rollback())
									}
									return nil
								})
							}
							committed := outcome != "rollback" && outcome != "commit failure"
							require.Equal(t, committed && outcome != "standalone", followingEvent, "refresh failure must not stop later events")
							if committed {
								require.NoError(t, err)
							} else {
								require.Error(t, err)
							}
							if committed && outcome != "permission failure" {
								require.Equal(t, []string{"clear user", "clear service account", "refresh"}, recorder.calls)
							} else {
								require.Empty(t, recorder.calls)
							}
							permissions, err := ac.GetUserPermissions(ctx, requester, accesscontrol.Options{ReloadCache: outcome == "refresh failure"})
							require.NoError(t, err)
							if committed && outcome != "permission failure" {
								require.Contains(t, permissions, grant)
							} else {
								require.NotContains(t, permissions, grant)
							}
						})
					}
				}
			}
		})
	}
}

type creatorContextKey struct{}
type creatorRefreshFollowingEvent struct{}

type creatorPermissionRecorder struct {
	accesscontrol.Service
	t          *testing.T
	calls      []string
	refreshErr error
}

func (r *creatorPermissionRecorder) ClearUserPermissionCache(requester identity.Requester) {
	name := "clear user"
	if requester.IsIdentityType(claims.TypeServiceAccount) {
		name = "clear service account"
	}
	r.calls = append(r.calls, name)
	r.Service.ClearUserPermissionCache(requester)
}

func (r *creatorPermissionRecorder) GetUserPermissions(ctx context.Context, requester identity.Requester, options accesscontrol.Options) ([]accesscontrol.Permission, error) {
	require.False(r.t, sqlstore.IsInTransaction(ctx))
	require.True(r.t, options.ReloadCache)
	require.Equal(r.t, "owner", ctx.Value(creatorContextKey{}))
	r.calls = append(r.calls, "refresh")
	if r.refreshErr != nil {
		return nil, r.refreshErr
	}
	return r.Service.GetUserPermissions(ctx, requester, options)
}
