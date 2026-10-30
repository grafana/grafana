package ossaccesscontrol

import (
	"context"
	"errors"
	"testing"
	"time"

	claims "github.com/grafana/authlib/types"
	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	tracesdk "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
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
			for _, tc := range []struct {
				name        string
				rollback    bool
				standalone  bool
				refreshErr  error
				cancelCopy  bool
				skipRefresh bool
			}{
				{name: "nested commit"},
				{name: "nested rollback", rollback: true},
				{name: "standalone", standalone: true},
				{name: "nil requester", standalone: true, skipRefresh: true},
				{name: "cancelled copy", standalone: true, cancelCopy: true},
				{name: "refresh failure", refreshErr: errors.New("AuthZ unavailable")},
			} {
				t.Run(tc.name, func(t *testing.T) {
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
					type requestKey struct{}
					ctx = context.WithValue(ctx, requestKey{}, "request metadata")
					recorder := &permissionRefreshRecorder{Service: ac, t: t, err: tc.refreshErr, checkContext: func(ctx context.Context) {
						require.Equal(t, "request metadata", ctx.Value(requestKey{}))
						deadline, ok := ctx.Deadline()
						require.True(t, ok)
						require.WithinDuration(t, time.Now().Add(5*time.Second), deadline, time.Second)
					}}
					receivers, err := ProvideReceiverPermissionsService(cfg, features, routing.NewRouteRegister(), sql,
						actest.FakeAccessControl{ExpectedEvaluate: true}, iam.Features{}, license, recorder, nil, nil, nil, actions)
					require.NoError(t, err)
					requester := &user.SignedInUser{UserID: 7, UserUID: "seven", OrgID: 1, OrgRole: org.RoleViewer}
					_, err = receivers.SetPermissions(ctx, 1, "old", accesscontrol.SetResourcePermissionCommand{
						BuiltinRole: string(org.RoleViewer), Permission: string(models.PermissionView),
					})
					require.NoError(t, err)
					oldGrant := accesscontrol.Permission{Action: accesscontrol.ActionAlertingReceiversRead, Scope: "receivers:uid:old"}
					newGrant := accesscontrol.Permission{Action: accesscontrol.ActionAlertingReceiversRead, Scope: "receivers:uid:new"}
					permissions, err := ac.GetUserPermissions(ctx, requester, accesscontrol.Options{})
					require.NoError(t, err)
					require.Contains(t, permissions, oldGrant)
					rollbackErr := errors.New("rollback")
					if tc.standalone {
						var actor identity.Requester = requester
						if tc.skipRefresh {
							actor = nil
						}
						copyCtx := ctx
						if tc.cancelCopy {
							var cancel context.CancelFunc
							copyCtx, cancel = context.WithCancel(ctx)
							cancel()
						}
						_, err = receivers.CopyPermissions(copyCtx, 1, actor, "old", "new")
					} else {
						err = sql.InTransaction(ctx, func(ctx context.Context) error {
							require.NoError(t, sql.InTransaction(ctx, func(ctx context.Context) error {
								_, err := receivers.CopyPermissions(ctx, 1, requester, "old", "new")
								return err
							}))
							require.NoError(t, receivers.DeleteResourcePermissions(ctx, 1, "old"))
							require.Zero(t, recorder.calls, "refresh must wait for the outermost commit")
							if tc.rollback {
								return rollbackErr
							}
							return nil
						})
					}
					if tc.rollback {
						require.ErrorIs(t, err, rollbackErr)
						require.Zero(t, recorder.calls)
					} else if tc.cancelCopy {
						require.Error(t, err)
						require.Zero(t, recorder.calls)
					} else {
						require.NoError(t, err)
						if tc.skipRefresh {
							require.Zero(t, recorder.calls)
						} else {
							require.Equal(t, 1, recorder.calls)
						}
					}
					permissions, err = ac.GetUserPermissions(ctx, requester, accesscontrol.Options{})
					require.NoError(t, err)
					if tc.rollback || tc.cancelCopy {
						require.Contains(t, permissions, oldGrant)
						require.NotContains(t, permissions, newGrant)
						// Read from the database, not the cache, to prove the rollback.
						permissions, err = ac.GetUserPermissions(ctx, requester, accesscontrol.Options{ReloadCache: true})
						require.NoError(t, err)
						require.Contains(t, permissions, oldGrant)
						require.NotContains(t, permissions, newGrant)
					} else if tc.skipRefresh {
						permissions, err = ac.GetUserPermissions(ctx, requester, accesscontrol.Options{ReloadCache: true})
						require.NoError(t, err)
						require.Contains(t, permissions, oldGrant)
						require.Contains(t, permissions, newGrant)
					} else if tc.refreshErr != nil {
						// A failed refresh must not undo the committed permission changes.
						permissions, err = ac.GetUserPermissions(ctx, requester, accesscontrol.Options{ReloadCache: true})
						require.NoError(t, err)
						require.Contains(t, permissions, newGrant)
						require.NotContains(t, permissions, oldGrant)
					} else {
						require.Contains(t, permissions, newGrant)
						if tc.standalone {
							require.Contains(t, permissions, oldGrant)
						} else {
							require.NotContains(t, permissions, oldGrant)
						}
					}
				})
			}
		})
	}
}

func TestReceiverPermissionsCopiedRefreshFailure(t *testing.T) {
	spans := tracetest.NewSpanRecorder()
	provider := tracesdk.NewTracerProvider(tracesdk.WithSpanProcessor(spans))
	t.Cleanup(func() { require.NoError(t, provider.Shutdown(context.Background())) })
	ctx, parent := provider.Tracer("test").Start(t.Context(), "receiver update")
	errRefresh := errors.New("AuthZ unavailable")
	recorder := &permissionRefreshRecorder{t: t, err: errRefresh}
	receivers := ReceiverPermissionsService{ac: recorder}
	require.NoError(t, receivers.onPermissionsCopied(ctx, &receiverPermissionsCopied{user: &user.SignedInUser{UserID: 7, OrgID: 1}}))
	require.Equal(t, 1, recorder.calls)
	parent.End()
	ended := spans.Ended()
	require.Len(t, ended, 2)
	require.Empty(t, ended[0].Events(), "the helper must not duplicate the listener's exception event")
	require.Equal(t, codes.Error, ended[1].Status().Code)
	require.Equal(t, errRefresh.Error(), ended[1].Status().Description)
	require.Len(t, ended[1].Events(), 1)
	require.Equal(t, "exception", ended[1].Events()[0].Name)
}

func TestReceiverPermissionsRefresh(t *testing.T) {
	for _, tc := range []struct {
		name      string
		requester identity.Requester
		cancel    bool
		session   any
		err       error
		wantCalls int
	}{
		{name: "user", requester: &user.SignedInUser{UserID: 7, OrgID: 1}, wantCalls: 1},
		{name: "failure", requester: &user.SignedInUser{UserID: 7, OrgID: 1}, err: errors.New("AuthZ unavailable"), wantCalls: 1},
		{name: "cancellation", requester: &user.SignedInUser{UserID: 7, OrgID: 1}, cancel: true, wantCalls: 1},
		{name: "inside SQL transaction", requester: &user.SignedInUser{UserID: 7, OrgID: 1}, session: &sqlstore.DBSession{}},
		{name: "typed nil SQL session", requester: &user.SignedInUser{UserID: 7, OrgID: 1}, session: (*sqlstore.DBSession)(nil), wantCalls: 1},
		{name: "nil user"},
		{name: "service account", requester: &user.SignedInUser{UserID: 7, OrgID: 1, IsServiceAccount: true}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			type requestKey struct{}
			spans := tracetest.NewSpanRecorder()
			provider := tracesdk.NewTracerProvider(tracesdk.WithSpanProcessor(spans))
			t.Cleanup(func() { require.NoError(t, provider.Shutdown(context.Background())) })
			ctx, parent := provider.Tracer("test").Start(t.Context(), "receiver update")
			defer parent.End()
			ctx = context.WithValue(ctx, requestKey{}, "request metadata")
			if tc.session != nil {
				ctx = context.WithValue(ctx, sqlstore.ContextSessionKey{}, tc.session)
			}
			var deadline time.Time
			if tc.cancel {
				var cancel context.CancelFunc
				ctx, cancel = context.WithTimeout(ctx, time.Second)
				defer cancel()
				deadline, _ = ctx.Deadline()
				cancel()
			}
			recorder := &permissionRefreshRecorder{t: t, err: tc.err, checkContext: func(ctx context.Context) {
				require.Equal(t, "request metadata", ctx.Value(requestKey{}))
				got, ok := ctx.Deadline()
				require.True(t, ok)
				if tc.cancel {
					require.ErrorIs(t, ctx.Err(), context.Canceled)
					require.Equal(t, deadline, got)
				} else {
					require.WithinDuration(t, time.Now().Add(5*time.Second), got, time.Second)
				}
			}}
			receivers := ReceiverPermissionsService{ac: recorder, log: log.NewNopLogger()}
			err := receivers.refreshPermissions(ctx, tc.requester)
			if tc.err != nil {
				require.ErrorIs(t, err, tc.err)
			} else {
				require.NoError(t, err)
			}
			require.Equal(t, tc.wantCalls, recorder.calls)

			ended := spans.Ended()
			if tc.requester == nil || !tc.requester.IsIdentityType(claims.TypeUser) {
				require.Empty(t, ended)
				return
			}
			require.Len(t, ended, 1)
			span := ended[0]
			require.Equal(t, "accesscontrol.ossaccesscontrol.RefreshPermissions", span.Name())
			require.Equal(t, parent.SpanContext(), span.Parent())
			require.Contains(t, span.Attributes(), attribute.Bool("is_in_tx", tc.name == "inside SQL transaction"))
			// Callers own error recording to avoid duplicate exception events.
			require.Equal(t, codes.Unset, span.Status().Code)
			require.Empty(t, span.Events())
		})
	}
}

type permissionRefreshRecorder struct {
	accesscontrol.Service
	t            *testing.T
	calls        int
	err          error
	checkContext func(context.Context)
}

func (r *permissionRefreshRecorder) GetUserPermissions(ctx context.Context, user identity.Requester, options accesscontrol.Options) ([]accesscontrol.Permission, error) {
	r.calls++
	require.Nil(r.t, ctx.Value(sqlstore.ContextSessionKey{}))
	require.True(r.t, options.ReloadCache)
	if r.checkContext != nil {
		r.checkContext(ctx)
	}
	if r.err != nil {
		return nil, r.err
	}
	if r.Service == nil {
		return nil, nil
	}
	return r.Service.GetUserPermissions(ctx, user, options)
}
