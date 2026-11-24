package acimpl

import (
	"context"
	"errors"
	"testing"
	"testing/synctest"
	"time"

	"github.com/fullstorydev/grpchan/inprocgrpc"
	"github.com/grafana/authlib/types"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/shadow"
	"github.com/grafana/grafana/pkg/services/authz/legacyclient"
	authzv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type checkShadowServer struct {
	authzv1.UnimplementedLegacyAuthzServiceServer
	response authzv1.LegacyCheckResponse
	err      error
	calls    int
	check    func(context.Context, *authzv1.LegacyCheckRequest) (*authzv1.LegacyCheckResponse, error)
}

func (s *checkShadowServer) LegacyCheck(ctx context.Context, req *authzv1.LegacyCheckRequest) (*authzv1.LegacyCheckResponse, error) {
	s.calls++
	if s.check != nil {
		return s.check(ctx, req)
	}
	return &s.response, s.err
}

func newCheckShadowAccessControl(t *testing.T, server *checkShadowServer) *AccessControl {
	t.Helper()
	ac := ProvideAccessControlTest()
	channel := &inprocgrpc.Channel{}
	authzv1.RegisterLegacyAuthzServiceServer(channel, server)
	require.NoError(t, ac.SetLegacyCheckClient(legacyclient.NewLegacyClient(channel), types.OrgNamespaceFormatter, prometheus.NewRegistry()))
	return ac
}

func checkShadowUser() *identity.StaticRequester {
	return &identity.StaticRequester{
		Type:      types.TypeUser,
		UserID:    7,
		UserUID:   "checked-user",
		OrgID:     12,
		Namespace: "org-12",
		Permissions: map[int64]map[string][]string{
			12: {"folders:read": {"folders:uid:allowed"}},
		},
	}
}

func TestEvaluateLegacyCheckShadowRouting(t *testing.T) {
	for _, tc := range []struct {
		name             string
		primaryEnabled   bool
		shadowEnabled    bool
		withoutResolvers bool
		wantAllowed      bool
		wantCalls        int
	}{
		{
			name:        "flags off use local evaluation",
			wantAllowed: true,
		},
		{
			name:           "primary only uses LegacyCheck",
			primaryEnabled: true,
			wantCalls:      1,
		},
		{
			name:          "shadow alone uses local evaluation",
			shadowEnabled: true,
			wantAllowed:   true,
		},
		{
			name:           "both flags preserve local evaluation",
			primaryEnabled: true,
			shadowEnabled:  true,
			wantAllowed:    true,
			wantCalls:      1,
		},
		{
			name:             "without resolvers retains shadowing",
			primaryEnabled:   true,
			shadowEnabled:    true,
			withoutResolvers: true,
			wantAllowed:      true,
			wantCalls:        1,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			featuremgmt.WithFlagValues(t, map[string]any{
				featuremgmt.FlagAuthzUseLegacyCheck:       tc.primaryEnabled,
				featuremgmt.FlagAuthzUseLegacyCheckShadow: tc.shadowEnabled,
			})
			// Local evaluation allows this request; LegacyCheck denies it.
			server := &checkShadowServer{}
			ac := newCheckShadowAccessControl(t, server)
			var evaluator accesscontrol.AccessControl = ac
			if tc.withoutResolvers {
				evaluator = ac.WithoutResolvers()
			}

			synctest.Test(t, func(t *testing.T) {
				allowed, err := evaluator.Evaluate(t.Context(), checkShadowUser(), accesscontrol.EvalPermission("folders:read", "folders:uid:allowed"))

				require.NoError(t, err)
				require.Equal(t, tc.wantAllowed, allowed)
				synctest.Wait()
				require.Equal(t, tc.wantCalls, server.calls)
				if tc.primaryEnabled && tc.shadowEnabled {
					require.Equal(t, float64(1), testutil.ToFloat64(ac.legacyCheckShadow.results.WithLabelValues(string(shadow.Mismatch))))
				} else {
					require.Zero(t, testutil.CollectAndCount(ac.legacyCheckShadow.results))
				}
			})
		})
	}
}

func TestLegacyCheckShadowComparisons(t *testing.T) {
	for _, tc := range []struct {
		name          string
		localAllowed  bool
		shadowAllowed bool
		responseError string
		rpcError      error
		wantOutcome   shadow.Outcome
	}{
		{
			name:          "matching allow",
			localAllowed:  true,
			shadowAllowed: true,
			wantOutcome:   shadow.Match,
		},
		{
			name:        "matching deny",
			wantOutcome: shadow.Match,
		},
		{
			name:         "shadow deny preserves local allow",
			localAllowed: true,
			wantOutcome:  shadow.Mismatch,
		},
		{
			name:          "shadow allow preserves local deny",
			shadowAllowed: true,
			wantOutcome:   shadow.Mismatch,
		},
		{
			name:          "response error preserves local allow",
			localAllowed:  true,
			responseError: "backend failed",
			wantOutcome:   shadow.Failed,
		},
		{
			name:         "RPC error preserves local allow",
			localAllowed: true,
			rpcError:     errors.New("RPC failed"),
			wantOutcome:  shadow.Failed,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			featuremgmt.WithEnabledFlags(t, featuremgmt.FlagAuthzUseLegacyCheck, featuremgmt.FlagAuthzUseLegacyCheckShadow)
			server := &checkShadowServer{
				response: authzv1.LegacyCheckResponse{Allowed: tc.shadowAllowed, Error: tc.responseError},
				err:      tc.rpcError,
			}
			ac := newCheckShadowAccessControl(t, server)
			requester := checkShadowUser()
			if !tc.localAllowed {
				requester.Permissions = nil
			}

			synctest.Test(t, func(t *testing.T) {
				allowed, err := ac.Evaluate(t.Context(), requester, accesscontrol.EvalPermission("folders:read", "folders:uid:allowed"))

				require.NoError(t, err)
				require.Equal(t, tc.localAllowed, allowed)
				synctest.Wait()
				require.Equal(t, 1, server.calls)
				require.Equal(t, float64(1), testutil.ToFloat64(ac.legacyCheckShadow.results.WithLabelValues(string(tc.wantOutcome))))
			})
		})
	}
}

func TestLegacyCheckShadowPreservesPrimaryError(t *testing.T) {
	featuremgmt.WithEnabledFlags(t, featuremgmt.FlagAuthzUseLegacyCheck, featuremgmt.FlagAuthzUseLegacyCheckShadow)
	ac := newCheckShadowAccessControl(t, &checkShadowServer{
		response: authzv1.LegacyCheckResponse{Allowed: true},
	})
	wantErr := errors.New("local resolver failed")
	ac.RegisterScopeAttributeResolver("test:id:", accesscontrol.ScopeAttributeResolverFunc(func(context.Context, int64, string) ([]string, error) {
		return nil, wantErr
	}))

	synctest.Test(t, func(t *testing.T) {
		allowed, err := ac.Evaluate(t.Context(), checkShadowUser(), accesscontrol.EvalPermission("folders:read", "test:id:one"))

		require.False(t, allowed)
		require.ErrorIs(t, err, wantErr)
		synctest.Wait()
		require.Equal(t, float64(1), testutil.ToFloat64(ac.legacyCheckShadow.results.WithLabelValues("error")))
	})
}

func TestLegacyCheckShadowSnapshotsAndDetaches(t *testing.T) {
	featuremgmt.WithEnabledFlags(t, featuremgmt.FlagAuthzUseLegacyCheck, featuremgmt.FlagAuthzUseLegacyCheckShadow)
	server := &checkShadowServer{}
	ac := newCheckShadowAccessControl(t, server)

	synctest.Test(t, func(t *testing.T) {
		type requestKey struct{}
		ctx, cancel := context.WithCancel(context.WithValue(t.Context(), requestKey{}, "caller state"))
		defer cancel()

		release := make(chan struct{})
		var captured *authzv1.LegacyCheckRequest
		var executionContext context.Context
		var executionError error
		server.check = func(ctx context.Context, req *authzv1.LegacyCheckRequest) (*authzv1.LegacyCheckResponse, error) {
			<-release
			captured = req
			executionContext = inprocgrpc.ClientContext(ctx)
			executionError = executionContext.Err()
			return &authzv1.LegacyCheckResponse{Allowed: true}, nil
		}
		requester := checkShadowUser()
		scopes := []string{"folders:uid:allowed"}
		children := []accesscontrol.Evaluator{accesscontrol.EvalPermission("folders:read", scopes...)}

		allowed, err := ac.Evaluate(ctx, requester, accesscontrol.EvalAll(children...))
		require.NoError(t, err)
		require.True(t, allowed)

		cancel()
		requester.UserUID = "changed"
		requester.GetPermissions()["users:delete"] = []string{"*"}
		scopes[0] = "folders:uid:changed"
		children[0] = accesscontrol.EvalPermission("users:delete")
		close(release)
		synctest.Wait()

		expression, err := accesscontrol.ToLegacyExpression(accesscontrol.EvalAll(
			accesscontrol.EvalPermission("folders:read", "folders:uid:allowed"),
		))
		require.NoError(t, err)
		want := &authzv1.LegacyCheckRequest{
			Namespace:      "org-12",
			Subject:        "user:checked-user",
			RequesterOrgId: proto.Int64(12),
			Restriction:    &authzv1.LegacyActionRestriction{Actions: []string{"folders:read"}},
			Expression:     expression,
		}
		require.True(t, proto.Equal(want, captured), "want %v, got %v", want, captured)
		require.Nil(t, executionContext.Value(requestKey{}))
		require.True(t, shadow.IsShadow(executionContext))
		require.NoError(t, executionError)
		require.Equal(t, float64(1), testutil.ToFloat64(ac.legacyCheckShadow.results.WithLabelValues("match")))
	})
}

func TestLegacyCheckShadowSkipsTransactions(t *testing.T) {
	featuremgmt.WithEnabledFlags(t, featuremgmt.FlagAuthzUseLegacyCheck, featuremgmt.FlagAuthzUseLegacyCheckShadow)
	server := &checkShadowServer{}
	ac := newCheckShadowAccessControl(t, server)

	synctest.Test(t, func(t *testing.T) {
		ctx := context.WithValue(t.Context(), sqlstore.ContextSessionKey{}, &sqlstore.DBSession{})

		allowed, err := ac.Evaluate(ctx, checkShadowUser(), accesscontrol.EvalPermission("folders:read"))

		require.NoError(t, err)
		require.True(t, allowed)
		synctest.Wait()
		require.Zero(t, server.calls)
		require.Equal(t, float64(1), testutil.ToFloat64(ac.legacyCheckShadow.skipped.WithLabelValues(string(shadow.Transaction))))
	})
}

func TestLegacyCheckShadowSkipsWhenAtCapacity(t *testing.T) {
	featuremgmt.WithEnabledFlags(t, featuremgmt.FlagAuthzUseLegacyCheck, featuremgmt.FlagAuthzUseLegacyCheckShadow)
	server := &checkShadowServer{}
	ac := newCheckShadowAccessControl(t, server)
	var err error
	ac.legacyCheckShadow.runner, err = shadow.NewRunner(1, 10*time.Second)
	require.NoError(t, err)

	synctest.Test(t, func(t *testing.T) {
		release := make(chan struct{})
		server.check = func(context.Context, *authzv1.LegacyCheckRequest) (*authzv1.LegacyCheckResponse, error) {
			<-release
			return &authzv1.LegacyCheckResponse{Allowed: true}, nil
		}

		allowed, err := ac.Evaluate(t.Context(), checkShadowUser(), accesscontrol.EvalPermission("folders:read"))
		require.NoError(t, err)
		require.True(t, allowed)
		synctest.Wait()

		allowed, err = ac.Evaluate(t.Context(), checkShadowUser(), accesscontrol.EvalPermission("folders:read"))
		require.NoError(t, err)
		require.True(t, allowed)
		synctest.Wait()

		require.Equal(t, 1, server.calls)
		require.Equal(t, float64(1), testutil.ToFloat64(ac.legacyCheckShadow.skipped.WithLabelValues(string(shadow.Capacity))))
		close(release)
		synctest.Wait()
	})
}

func TestLegacyCheckShadowTimeout(t *testing.T) {
	featuremgmt.WithEnabledFlags(t, featuremgmt.FlagAuthzUseLegacyCheck, featuremgmt.FlagAuthzUseLegacyCheckShadow)
	ac := newCheckShadowAccessControl(t, &checkShadowServer{
		check: func(ctx context.Context, _ *authzv1.LegacyCheckRequest) (*authzv1.LegacyCheckResponse, error) {
			<-ctx.Done()
			return nil, ctx.Err()
		},
	})

	synctest.Test(t, func(t *testing.T) {
		allowed, err := ac.Evaluate(t.Context(), checkShadowUser(), accesscontrol.EvalPermission("folders:read"))
		require.NoError(t, err)
		require.True(t, allowed)

		time.Sleep(10 * time.Second)
		synctest.Wait()
		require.Equal(t, float64(1), testutil.ToFloat64(ac.legacyCheckShadow.results.WithLabelValues("error")))
	})
}

func TestLegacyCheckShadowMismatchLogs(t *testing.T) {
	featuremgmt.WithEnabledFlags(t, featuremgmt.FlagAuthzUseLegacyCheck, featuremgmt.FlagAuthzUseLegacyCheckShadow)
	ac := newCheckShadowAccessControl(t, &checkShadowServer{})
	logger := &permissionShadowLogger{}
	ac.legacyCheckShadow.logger = logger

	synctest.Test(t, func(t *testing.T) {
		_, err := ac.Evaluate(t.Context(), checkShadowUser(), accesscontrol.EvalPermission("folders:read", "folders:uid:allowed"))
		require.NoError(t, err)
		synctest.Wait()

		require.Equal(t, logtest.Logs{
			Calls:   1,
			Message: "LegacyCheck shadow results differ",
			Ctx:     []any{"namespace", "org-12", "subject", "user:checked-user", "permissions", "action:folders:read scopes:folders:uid:allowed", "currentAllowed", true, "shadowAllowed", false},
		}, logger.WarnLogs)
	})
}

type customCheckShadowEvaluator struct{ accesscontrol.Evaluator }

type panicCheckShadowRequester struct{ identity.Requester }

func (panicCheckShadowRequester) GetNamespace() string { panic("request snapshot failed") }

func TestLegacyCheckShadowPreparationFailuresPreservePrimary(t *testing.T) {
	for _, tc := range []struct {
		name      string
		requester identity.Requester
		evaluator accesscontrol.Evaluator
	}{
		{
			name:      "unsupported evaluator",
			requester: checkShadowUser(),
			evaluator: customCheckShadowEvaluator{accesscontrol.EvalPermission("folders:read")},
		},
		{
			name:      "snapshot panic",
			requester: panicCheckShadowRequester{checkShadowUser()},
			evaluator: accesscontrol.EvalPermission("folders:read"),
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			featuremgmt.WithEnabledFlags(t, featuremgmt.FlagAuthzUseLegacyCheck, featuremgmt.FlagAuthzUseLegacyCheckShadow)
			server := &checkShadowServer{}
			ac := newCheckShadowAccessControl(t, server)

			synctest.Test(t, func(t *testing.T) {
				allowed, err := ac.Evaluate(t.Context(), tc.requester, tc.evaluator)

				require.NoError(t, err)
				require.True(t, allowed)
				synctest.Wait()
				require.Zero(t, server.calls)
				require.Equal(t, float64(1), testutil.ToFloat64(ac.legacyCheckShadow.results.WithLabelValues("error")))
			})
		})
	}
}
