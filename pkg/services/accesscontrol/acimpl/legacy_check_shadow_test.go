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
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/shadow"
	"github.com/grafana/grafana/pkg/services/authz/legacyclient"
	authzv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type checkShadowServer struct {
	authzv1.UnimplementedLegacyAuthzServiceServer
	check func(context.Context, *authzv1.LegacyCheckRequest) (*authzv1.LegacyCheckResponse, error)
}

func (s *checkShadowServer) LegacyCheck(ctx context.Context, req *authzv1.LegacyCheckRequest) (*authzv1.LegacyCheckResponse, error) {
	return s.check(ctx, req)
}

func newCheckShadowAccessControl(t *testing.T, ac *AccessControl, check func(context.Context, *authzv1.LegacyCheckRequest) (*authzv1.LegacyCheckResponse, error)) *AccessControl {
	t.Helper()
	channel := &inprocgrpc.Channel{}
	authzv1.RegisterLegacyAuthzServiceServer(channel, &checkShadowServer{check: check})
	require.NoError(t, ac.SetLegacyCheckClient(legacyclient.NewLegacyClient(channel), false, types.OrgNamespaceFormatter, prometheus.NewRegistry()))
	return ac
}

func checkShadowUser() *identity.StaticRequester {
	return &identity.StaticRequester{Type: types.TypeUser, UserID: 7, UserUID: "checked-user", OrgID: 12, Namespace: "org-12", Groups: []string{"team-one"}, Permissions: map[int64]map[string][]string{12: {"folders:read": {"folders:uid:allowed"}}}}
}

func TestEvaluateLegacyCheckShadowRouting(t *testing.T) {
	for _, tc := range []struct {
		name                     string
		primary, shadow          bool
		localAllowed, rpcAllowed bool
		rpcError                 string
		withoutResolvers         bool
		allowed                  bool
		calls                    int
		outcome                  string
	}{
		{name: "flags off", localAllowed: true, allowed: true},
		{name: "primary only", primary: true, localAllowed: true, calls: 1},
		{name: "shadow alone stays local", shadow: true, localAllowed: true, allowed: true},
		{name: "matching allow", primary: true, shadow: true, localAllowed: true, rpcAllowed: true, allowed: true, calls: 1, outcome: "match"},
		{name: "matching deny", primary: true, shadow: true, calls: 1, outcome: "match"},
		{name: "shadow deny preserves local allow", primary: true, shadow: true, localAllowed: true, allowed: true, calls: 1, outcome: "mismatch"},
		{name: "shadow allow preserves local deny", primary: true, shadow: true, rpcAllowed: true, calls: 1, outcome: "mismatch"},
		{name: "shadow failure preserves local allow", primary: true, shadow: true, localAllowed: true, rpcError: "backend failed", allowed: true, calls: 1, outcome: "error"},
		{name: "without resolvers retains shadow", primary: true, shadow: true, localAllowed: true, rpcAllowed: true, withoutResolvers: true, allowed: true, calls: 1, outcome: "match"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			featuremgmt.WithFlagValues(t, map[string]any{featuremgmt.FlagAuthzUseLegacyCheck: tc.primary, featuremgmt.FlagAuthzUseLegacyCheckShadow: tc.shadow})
			calls := 0
			ac := newCheckShadowAccessControl(t, ProvideAccessControlTest(), func(context.Context, *authzv1.LegacyCheckRequest) (*authzv1.LegacyCheckResponse, error) {
				calls++
				return &authzv1.LegacyCheckResponse{Allowed: tc.rpcAllowed, Error: tc.rpcError}, nil
			})
			var evaluator accesscontrol.AccessControl = ac
			if tc.withoutResolvers {
				evaluator = ac.WithoutResolvers()
			}
			synctest.Test(t, func(t *testing.T) {
				requester := checkShadowUser()
				if !tc.localAllowed {
					requester.Permissions = nil
				}
				allowed, err := evaluator.Evaluate(t.Context(), requester, accesscontrol.EvalPermission("folders:read", "folders:uid:allowed"))
				require.NoError(t, err)
				require.Equal(t, tc.allowed, allowed)
				synctest.Wait()
				require.Equal(t, tc.calls, calls)
				if tc.outcome != "" {
					require.Equal(t, float64(1), testutil.ToFloat64(ac.legacyCheckShadow.results.WithLabelValues(tc.outcome)))
				} else {
					require.Zero(t, testutil.CollectAndCount(ac.legacyCheckShadow.results))
				}
			})
		})
	}
}

func TestLegacyCheckShadowPreservesPrimaryError(t *testing.T) {
	ac := ProvideAccessControlTest()
	synctest.Test(t, func(t *testing.T) {
		featuremgmt.WithEnabledFlags(t, featuremgmt.FlagAuthzUseLegacyCheck, featuremgmt.FlagAuthzUseLegacyCheckShadow)
		ac := newCheckShadowAccessControl(t, ac, func(context.Context, *authzv1.LegacyCheckRequest) (*authzv1.LegacyCheckResponse, error) {
			return &authzv1.LegacyCheckResponse{Allowed: true}, nil
		})
		wantErr := errors.New("local resolver failed")
		ac.RegisterScopeAttributeResolver("test:id:", accesscontrol.ScopeAttributeResolverFunc(func(context.Context, int64, string) ([]string, error) { return nil, wantErr }))
		allowed, err := ac.Evaluate(t.Context(), checkShadowUser(), accesscontrol.EvalPermission("folders:read", "test:id:one"))
		require.False(t, allowed)
		require.ErrorIs(t, err, wantErr)
		synctest.Wait()
		require.Equal(t, float64(1), testutil.ToFloat64(ac.legacyCheckShadow.results.WithLabelValues("error")))
	})
}

func TestLegacyCheckShadowSnapshotsAndDetaches(t *testing.T) {
	ac := ProvideAccessControlTest()
	synctest.Test(t, func(t *testing.T) {
		featuremgmt.WithEnabledFlags(t, featuremgmt.FlagAuthzUseLegacyCheck, featuremgmt.FlagAuthzUseLegacyCheckShadow)
		type requestKey struct{}
		ctx, cancel := context.WithCancel(context.WithValue(t.Context(), requestKey{}, "caller state"))
		defer cancel()
		release := make(chan struct{})
		var captured *authzv1.LegacyCheckRequest
		var executionContext context.Context
		var executionError error
		ac := newCheckShadowAccessControl(t, ac, func(ctx context.Context, req *authzv1.LegacyCheckRequest) (*authzv1.LegacyCheckResponse, error) {
			<-release
			captured = req
			executionContext = inprocgrpc.ClientContext(ctx)
			executionError = executionContext.Err()
			return &authzv1.LegacyCheckResponse{Allowed: true}, nil
		})
		requester := checkShadowUser()
		scopes := []string{"folders:uid:allowed"}
		children := []accesscontrol.Evaluator{accesscontrol.EvalPermission("folders:read", scopes...)}
		allowed, err := ac.Evaluate(ctx, requester, accesscontrol.EvalAll(children...))
		require.NoError(t, err)
		require.True(t, allowed)
		cancel()
		requester.UserUID = "changed"
		requester.Groups[0] = "changed"
		requester.GetPermissions()["users:delete"] = []string{"*"}
		scopes[0] = "folders:uid:changed"
		children[0] = accesscontrol.EvalPermission("users:delete")
		close(release)
		synctest.Wait()
		orgID := int64(12)
		want := &authzv1.LegacyCheckRequest{
			Namespace: "org-12", Subject: "user:checked-user", RequesterOrgId: &orgID,
			Teams: []string{"team-one"}, Restriction: &authzv1.LegacyActionRestriction{Actions: []string{"folders:read"}},
			Expression: &authzv1.LegacyExpression{Node: &authzv1.LegacyExpression_All{All: &authzv1.LegacyExpressionList{Expressions: []*authzv1.LegacyExpression{
				{Node: &authzv1.LegacyExpression_Permission{Permission: &authzv1.LegacyPermission{Action: "folders:read", Scopes: []string{"folders:uid:allowed"}}}},
			}}}},
		}
		require.True(t, proto.Equal(want, captured), "want %v, got %v", want, captured)
		require.Nil(t, executionContext.Value(requestKey{}))
		require.True(t, shadow.IsShadow(executionContext))
		require.NoError(t, executionError)
		require.Equal(t, float64(1), testutil.ToFloat64(ac.legacyCheckShadow.results.WithLabelValues("match")))
	})
}

func TestLegacyCheckShadowSkipsTransactionsAndSaturation(t *testing.T) {
	ac := ProvideAccessControlTest()
	synctest.Test(t, func(t *testing.T) {
		featuremgmt.WithEnabledFlags(t, featuremgmt.FlagAuthzUseLegacyCheck, featuremgmt.FlagAuthzUseLegacyCheckShadow)
		release := make(chan struct{})
		calls := 0
		ac := newCheckShadowAccessControl(t, ac, func(context.Context, *authzv1.LegacyCheckRequest) (*authzv1.LegacyCheckResponse, error) {
			calls++
			<-release
			return &authzv1.LegacyCheckResponse{Allowed: true}, nil
		})
		var err error
		ac.legacyCheckShadow.runner, err = shadow.NewRunner(1, 10*time.Second)
		require.NoError(t, err)
		for _, ctx := range []context.Context{t.Context(), t.Context(), context.WithValue(t.Context(), sqlstore.ContextSessionKey{}, &sqlstore.DBSession{})} {
			allowed, err := ac.Evaluate(ctx, checkShadowUser(), accesscontrol.EvalPermission("folders:read"))
			require.NoError(t, err)
			require.True(t, allowed)
			synctest.Wait()
		}
		require.Equal(t, 1, calls)
		require.Equal(t, float64(1), testutil.ToFloat64(ac.legacyCheckShadow.skipped.WithLabelValues("capacity")))
		require.Equal(t, float64(1), testutil.ToFloat64(ac.legacyCheckShadow.skipped.WithLabelValues("transaction")))
		close(release)
		synctest.Wait()
	})
}

func TestLegacyCheckShadowTimeout(t *testing.T) {
	ac := ProvideAccessControlTest()
	synctest.Test(t, func(t *testing.T) {
		featuremgmt.WithEnabledFlags(t, featuremgmt.FlagAuthzUseLegacyCheck, featuremgmt.FlagAuthzUseLegacyCheckShadow)
		ac := newCheckShadowAccessControl(t, ac, func(ctx context.Context, _ *authzv1.LegacyCheckRequest) (*authzv1.LegacyCheckResponse, error) {
			<-ctx.Done()
			return nil, ctx.Err()
		})
		allowed, err := ac.Evaluate(t.Context(), checkShadowUser(), accesscontrol.EvalPermission("folders:read"))
		require.NoError(t, err)
		require.True(t, allowed)
		time.Sleep(10 * time.Second)
		synctest.Wait()
		require.Equal(t, float64(1), testutil.ToFloat64(ac.legacyCheckShadow.results.WithLabelValues("error")))
	})
}

func TestLegacyCheckShadowMismatchLogs(t *testing.T) {
	ac := ProvideAccessControlTest()
	synctest.Test(t, func(t *testing.T) {
		featuremgmt.WithEnabledFlags(t, featuremgmt.FlagAuthzUseLegacyCheck, featuremgmt.FlagAuthzUseLegacyCheckShadow)
		ac := newCheckShadowAccessControl(t, ac, func(context.Context, *authzv1.LegacyCheckRequest) (*authzv1.LegacyCheckResponse, error) {
			return &authzv1.LegacyCheckResponse{}, nil
		})
		logger := &permissionShadowLogger{}
		ac.legacyCheckShadow.logger = logger
		_, err := ac.Evaluate(t.Context(), checkShadowUser(), accesscontrol.EvalPermission("folders:read"))
		require.NoError(t, err)
		synctest.Wait()
		require.Equal(t, "LegacyCheck shadow results differ", logger.WarnLogs.Message)
		require.Equal(t, []any{"namespace", "org-12", "subject", "user:checked-user", "currentAllowed", true, "shadowAllowed", false}, logger.WarnLogs.Ctx)
	})
}

type customCheckShadowEvaluator struct{ accesscontrol.Evaluator }

type panicCheckShadowRequester struct{ identity.Requester }

func (panicCheckShadowRequester) GetGroups() []string { panic("request snapshot failed") }

func TestLegacyCheckShadowPreparationFailuresPreservePrimary(t *testing.T) {
	for _, tc := range []struct {
		name      string
		requester identity.Requester
		evaluator accesscontrol.Evaluator
	}{
		{name: "unsupported evaluator", requester: checkShadowUser(), evaluator: customCheckShadowEvaluator{accesscontrol.EvalPermission("folders:read")}},
		{name: "snapshot panic", requester: panicCheckShadowRequester{checkShadowUser()}, evaluator: accesscontrol.EvalPermission("folders:read")},
	} {
		t.Run(tc.name, func(t *testing.T) {
			featuremgmt.WithEnabledFlags(t, featuremgmt.FlagAuthzUseLegacyCheck, featuremgmt.FlagAuthzUseLegacyCheckShadow)
			calls := 0
			ac := newCheckShadowAccessControl(t, ProvideAccessControlTest(), func(context.Context, *authzv1.LegacyCheckRequest) (*authzv1.LegacyCheckResponse, error) {
				calls++
				return &authzv1.LegacyCheckResponse{}, nil
			})
			synctest.Test(t, func(t *testing.T) {
				allowed, err := ac.Evaluate(t.Context(), tc.requester, tc.evaluator)
				require.NoError(t, err)
				require.True(t, allowed)
				synctest.Wait()
				require.Zero(t, calls)
				require.Equal(t, float64(1), testutil.ToFloat64(ac.legacyCheckShadow.results.WithLabelValues("error")))
			})
		})
	}
}
