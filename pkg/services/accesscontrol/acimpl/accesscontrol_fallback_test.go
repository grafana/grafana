package acimpl_test

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

type fallbackChecker struct {
	mu     sync.Mutex
	calls  []*authzextv1.CheckPermissionRequest
	check  func(*authzextv1.CheckPermissionRequest) (bool, error)
	called chan struct{}
}

func (f *fallbackChecker) CheckPermission(_ context.Context, req *authzextv1.CheckPermissionRequest) (*authzextv1.CheckPermissionResponse, error) {
	f.mu.Lock()
	f.calls = append(f.calls, req)
	f.mu.Unlock()
	if f.called != nil {
		select {
		case f.called <- struct{}{}:
		default:
		}
	}
	allowed, err := f.check(req)
	if err != nil {
		return nil, err
	}
	return &authzextv1.CheckPermissionResponse{Allowed: allowed}, nil
}

func (f *fallbackChecker) callCount() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(f.calls)
}

func (f *fallbackChecker) lastCall() *authzextv1.CheckPermissionRequest {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.calls[len(f.calls)-1]
}

func newFallbackAccessControl(t *testing.T, primary setting.ZanzanaPrimaryEngine, checker *fallbackChecker, enabled bool) *acimpl.AccessControl {
	t.Helper()
	proxy := zanzana.ProvidePermissionCheckerProxy()
	proxy.Set(checker)
	cfg := setting.NewCfg()
	cfg.ZanzanaClient.PrimaryEngine = primary
	features := featuremgmt.WithFeatures(featuremgmt.FlagZanzanaRBACFallbackChecks, enabled)
	return acimpl.ProvideAccessControlWithFallback(features, cfg, proxy, nil)
}

func fallbackUser(permissions map[string][]string) *user.SignedInUser {
	return &user.SignedInUser{
		UserID: 1, UserUID: "user-one", OrgID: 1, Namespace: "default", TeamUIDs: []string{"team-one"},
		Permissions: map[int64]map[string][]string{1: permissions},
	}
}

func TestAccessControlFallbackFlagOffUsesOnlyRBAC(t *testing.T) {
	checker := &fallbackChecker{check: func(*authzextv1.CheckPermissionRequest) (bool, error) {
		return false, errors.New("must not be called")
	}}
	ac := newFallbackAccessControl(t, setting.ZanzanaPrimaryEngineZanzana, checker, false)

	allowed, err := ac.Evaluate(context.Background(), fallbackUser(map[string][]string{
		"plugins.app:read": {"plugins:id:one"},
	}), accesscontrol.EvalPermission("plugins.app:read", "plugins:id:one"))
	require.NoError(t, err)
	require.True(t, allowed)
	require.Zero(t, checker.callCount())
}

func TestAccessControlFallbackRBACPrimaryShadowsZanzana(t *testing.T) {
	called := make(chan struct{}, 1)
	checker := &fallbackChecker{called: called, check: func(*authzextv1.CheckPermissionRequest) (bool, error) { return true, nil }}
	ac := newFallbackAccessControl(t, setting.ZanzanaPrimaryEngineRBAC, checker, true)

	allowed, err := ac.Evaluate(context.Background(), fallbackUser(nil), accesscontrol.EvalPermission("plugins.app:read", "plugins:id:one"))
	require.NoError(t, err)
	require.False(t, allowed)
	select {
	case <-called:
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for Zanzana shadow evaluation")
	}
}

func TestAccessControlFallbackZanzanaPrimary(t *testing.T) {
	t.Run("allows fallback permission and sends canonical context", func(t *testing.T) {
		checker := &fallbackChecker{check: func(*authzextv1.CheckPermissionRequest) (bool, error) { return true, nil }}
		ac := newFallbackAccessControl(t, setting.ZanzanaPrimaryEngineZanzana, checker, true)

		allowed, err := ac.Evaluate(context.Background(), fallbackUser(nil), accesscontrol.EvalPermission("plugins.app:read", "plugins:id:one"))
		require.NoError(t, err)
		require.True(t, allowed)
		require.Equal(t, "default", checker.lastCall().Namespace)
		require.Equal(t, "user:user-one", checker.lastCall().Subject)
		require.Equal(t, []string{"team-one"}, checker.lastCall().Teams)
	})

	t.Run("successful denial does not fall back to RBAC", func(t *testing.T) {
		checker := &fallbackChecker{check: func(*authzextv1.CheckPermissionRequest) (bool, error) { return false, nil }}
		ac := newFallbackAccessControl(t, setting.ZanzanaPrimaryEngineZanzana, checker, true)
		usr := fallbackUser(map[string][]string{"plugins.app:read": {"plugins:id:one"}})

		allowed, err := ac.Evaluate(context.Background(), usr, accesscontrol.EvalPermission("plugins.app:read", "plugins:id:one"))
		require.NoError(t, err)
		require.False(t, allowed)
	})

	t.Run("errors fail closed even when RBAC allows", func(t *testing.T) {
		checker := &fallbackChecker{check: func(*authzextv1.CheckPermissionRequest) (bool, error) {
			return false, errors.New("unavailable")
		}}
		ac := newFallbackAccessControl(t, setting.ZanzanaPrimaryEngineZanzana, checker, true)
		usr := fallbackUser(map[string][]string{"plugins.app:read": {"plugins:id:one"}})

		allowed, err := ac.Evaluate(context.Background(), usr, accesscontrol.EvalPermission("plugins.app:read", "plugins:id:one"))
		require.Error(t, err)
		require.False(t, allowed)
	})

	t.Run("native leaves retain their RBAC behavior", func(t *testing.T) {
		checker := &fallbackChecker{check: func(*authzextv1.CheckPermissionRequest) (bool, error) {
			return false, errors.New("must not be called")
		}}
		ac := newFallbackAccessControl(t, setting.ZanzanaPrimaryEngineZanzana, checker, true)
		usr := fallbackUser(map[string][]string{accesscontrol.ActionTeamsWrite: {"teams:*"}})

		allowed, err := ac.Evaluate(context.Background(), usr, accesscontrol.EvalPermission(accesscontrol.ActionTeamsWrite, "teams:id:one"))
		require.NoError(t, err)
		require.True(t, allowed)
		require.Zero(t, checker.callCount())
	})

	t.Run("mixed-scope leaves OR native and fallback branches", func(t *testing.T) {
		checker := &fallbackChecker{check: func(req *authzextv1.CheckPermissionRequest) (bool, error) {
			require.Equal(t, []string{"roles:uid:specific"}, req.Scopes)
			return true, nil
		}}
		ac := newFallbackAccessControl(t, setting.ZanzanaPrimaryEngineZanzana, checker, true)

		allowed, err := ac.Evaluate(context.Background(), fallbackUser(nil), accesscontrol.EvalPermission("roles:read", "roles:*", "roles:uid:specific"))
		require.NoError(t, err)
		require.True(t, allowed)
	})

	t.Run("scopeless fallback uses the action marker", func(t *testing.T) {
		checker := &fallbackChecker{check: func(req *authzextv1.CheckPermissionRequest) (bool, error) {
			require.Equal(t, []string{""}, req.Scopes)
			return true, nil
		}}
		ac := newFallbackAccessControl(t, setting.ZanzanaPrimaryEngineZanzana, checker, true)

		allowed, err := ac.Evaluate(context.Background(), fallbackUser(nil), accesscontrol.EvalPermission("plugins.app:create"))
		require.NoError(t, err)
		require.True(t, allowed)
	})
}

func TestAccessControlFallbackCompositionsAndResolvers(t *testing.T) {
	checker := &fallbackChecker{check: func(req *authzextv1.CheckPermissionRequest) (bool, error) {
		for _, scope := range req.Scopes {
			if scope == "things:uid:resolved" || req.Action == "fallback:second" {
				return true, nil
			}
		}
		return req.Action == "fallback:first", nil
	}}
	ac := newFallbackAccessControl(t, setting.ZanzanaPrimaryEngineZanzana, checker, true)
	ac.RegisterScopeAttributeResolver("things:id:", accesscontrol.ScopeAttributeResolverFunc(func(context.Context, int64, string) ([]string, error) {
		return []string{"things:uid:resolved"}, nil
	}))

	t.Run("scope resolver retries after denial", func(t *testing.T) {
		allowed, err := ac.Evaluate(context.Background(), fallbackUser(nil), accesscontrol.EvalPermission("things:read", "things:id:legacy"))
		require.NoError(t, err)
		require.True(t, allowed)
	})

	t.Run("any and all preserve evaluator semantics", func(t *testing.T) {
		evaluator := accesscontrol.EvalAll(
			accesscontrol.EvalPermission("fallback:first", "one:id:1"),
			accesscontrol.EvalAny(
				accesscontrol.EvalPermission("fallback:denied", "two:id:2"),
				accesscontrol.EvalPermission("fallback:second", "three:id:3"),
			),
		)
		allowed, err := ac.Evaluate(context.Background(), fallbackUser(nil), evaluator)
		require.NoError(t, err)
		require.True(t, allowed)
	})

	t.Run("WithoutResolvers retains checker and rollout configuration", func(t *testing.T) {
		withoutResolvers := ac.WithoutResolvers()
		allowed, err := withoutResolvers.Evaluate(context.Background(), fallbackUser(nil), accesscontrol.EvalPermission("things:read", "things:id:legacy"))
		require.NoError(t, err)
		require.False(t, allowed)
	})
}
