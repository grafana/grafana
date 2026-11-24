package acimpl_test

import (
	"context"
	"errors"
	"testing"

	"github.com/go-jose/go-jose/v4/jwt"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"

	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/rbac"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestLegacyCheckReference_EmptyExpressions(t *testing.T) {
	for _, tc := range []struct {
		name          string
		evaluator     accesscontrol.Evaluator
		allowed       bool
		allowedWithXY bool
	}{
		{
			name:          "empty all",
			evaluator:     accesscontrol.EvalAll(),
			allowed:       true,
			allowedWithXY: true,
		},
		{
			name:      "empty any",
			evaluator: accesscontrol.EvalAny(),
		},
		{
			name: "nested empty all",
			evaluator: accesscontrol.EvalAny(
				accesscontrol.EvalPermission("dashboards:read", "dashboards:uid:dash-1"),
				accesscontrol.EvalAll(),
			),
			allowed:       true,
			allowedWithXY: true,
		},
		{
			name: "nested empty any",
			evaluator: accesscontrol.EvalAll(
				accesscontrol.EvalAny(),
				accesscontrol.EvalPermission("dashboards:read", "dashboards:uid:dash-1"),
			),
		},
		{
			name:      "empty action",
			evaluator: accesscontrol.EvalPermission(""),
		},
		{
			name: "empty action in any",
			evaluator: accesscontrol.EvalAny(
				accesscontrol.EvalPermission(""),
				accesscontrol.EvalPermission("x:y"),
			),
			allowedWithXY: true,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Run("no effective permissions", func(t *testing.T) {
				ac := acimpl.ProvideAccessControlTest()
				ac.RegisterScopeAttributeResolver("dashboards:uid:", accesscontrol.ScopeAttributeResolverFunc(
					func(context.Context, int64, string) ([]string, error) {
						t.Fatal("empty permission maps must be denied before scope resolution")
						return nil, nil
					},
				))
				// The raw evaluator and AccessControl have different empty-map semantics.
				require.Equal(t, tc.allowed, tc.evaluator.Evaluate(nil))
				allowed, err := ac.Evaluate(t.Context(), legacyReferenceUser(1, nil), tc.evaluator)
				require.NoError(t, err)
				require.False(t, allowed)
			})

			t.Run("unrelated effective permissions", func(t *testing.T) {
				ident := legacyReferenceUser(1, map[string][]string{
					"folders:read": {"folders:uid:folder-1"},
				})
				allowed, err := acimpl.ProvideAccessControlTest().Evaluate(t.Context(), ident, tc.evaluator)
				require.NoError(t, err)
				require.Equal(t, tc.allowed, allowed)
			})

			for _, grants := range []struct {
				name    string
				grant   accesscontrol.Permission
				allowed bool
			}{
				{
					name:    "LegacyCheck agrees with unrelated permissions",
					grant:   accesscontrol.Permission{Action: "folders:read", Scope: "folders:uid:folder-1"},
					allowed: tc.allowed,
				},
				{
					name:    "LegacyCheck agrees with x:y permission",
					grant:   accesscontrol.Permission{Action: "x:y", Scope: "*"},
					allowed: tc.allowedWithXY,
				},
			} {
				t.Run(grants.name, func(t *testing.T) {
					ident := legacyReferenceUser(12, map[string][]string{
						grants.grant.Action: {grants.grant.Scope},
					})
					localAllowed, err := acimpl.ProvideAccessControlTest().Evaluate(t.Context(), ident, tc.evaluator)
					require.NoError(t, err)
					require.Equal(t, grants.allowed, localAllowed)

					expression, err := accesscontrol.ToLegacyExpression(tc.evaluator)
					require.NoError(t, err)

					ctx := types.WithAuthInfo(t.Context(), authn.NewAccessTokenAuthInfo(authn.Claims[authn.AccessTokenClaims]{
						Claims: jwt.Claims{Subject: "service-account:test"},
						Rest:   authn.AccessTokenClaims{Namespace: "org-12"},
					}))
					service := rbac.NewTestService(ident.UserUID, []accesscontrol.Permission{grants.grant}, nil)
					response, err := service.LegacyCheck(ctx, &authzextv1.LegacyCheckRequest{
						Namespace:      "org-12",
						RequesterOrgId: proto.Int64(12),
						Subject:        "user:" + ident.UserUID,
						Expression:     expression,
					})
					require.NoError(t, err)
					require.Empty(t, response.GetError())
					require.Equal(t, localAllowed, response.GetAllowed())
				})
			}
		})
	}
}

func TestLegacyCheckReference_GlobalPermissions(t *testing.T) {
	for _, tc := range []struct {
		name        string
		orgID       int64
		permissions map[int64]map[string][]string
		allowed     bool
	}{
		{
			name:  "NoOrgID selects global permissions",
			orgID: accesscontrol.NoOrgID,
			permissions: map[int64]map[string][]string{
				accesscontrol.GlobalOrgID: {"users:read": {"users:*"}},
			},
			allowed: true,
		},
		{
			name:  "NoOrgID does not use permissions from an organization",
			orgID: accesscontrol.NoOrgID,
			permissions: map[int64]map[string][]string{
				1: {"users:read": {"users:*"}},
			},
		},
		{
			name:  "NoOrgID does not use a map stored under minus one",
			orgID: accesscontrol.NoOrgID,
			permissions: map[int64]map[string][]string{
				accesscontrol.NoOrgID: {"users:read": {"users:*"}},
			},
		},
		{
			name:  "organization check uses its effective permission map",
			orgID: 1,
			permissions: map[int64]map[string][]string{
				accesscontrol.GlobalOrgID: {"users:write": {"users:*"}},
				1:                         {"users:read": {"users:*"}},
			},
			allowed: true,
		},
		{
			name:  "organization evaluator does not union the global map itself",
			orgID: 1,
			permissions: map[int64]map[string][]string{
				accesscontrol.GlobalOrgID: {"users:read": {"users:*"}},
				1:                         {"users:write": {"users:*"}},
			},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ident := legacyReferenceUser(tc.orgID, nil)
			ident.Permissions = tc.permissions
			allowed, err := acimpl.ProvideAccessControlTest().Evaluate(
				t.Context(),
				ident,
				accesscontrol.EvalPermission("users:read", "users:id:1"),
			)
			require.NoError(t, err)
			require.Equal(t, tc.allowed, allowed)
		})
	}
}

func TestLegacyCheckReference_ResolverBehavior(t *testing.T) {
	for _, tc := range legacyResolverCases() {
		t.Run(tc.name, func(t *testing.T) {
			var calls []string
			ac := acimpl.ProvideAccessControlTest()
			ac.RegisterScopeAttributeResolver("dashboards:uid:", accesscontrol.ScopeAttributeResolverFunc(
				func(_ context.Context, orgID int64, scope string) ([]string, error) {
					require.Equal(t, int64(1), orgID)
					calls = append(calls, scope)
					resolution, ok := tc.resolutions[scope]
					require.True(t, ok, "unexpected resolver call for %s", scope)
					return resolution.scopes, resolution.err
				},
			))
			var evaluator accesscontrol.AccessControl = ac
			if tc.withoutResolvers {
				evaluator = ac.WithoutResolvers()
			}

			allowed, err := evaluator.Evaluate(t.Context(), legacyReferenceUser(1, tc.permissions), tc.evaluator)
			require.Equal(t, tc.allowed, allowed)
			if tc.wantErr != nil {
				require.ErrorIs(t, err, tc.wantErr)
			} else {
				require.NoError(t, err)
			}
			require.Equal(t, tc.wantCalls, calls)
		})
	}
}

func legacyReferenceUser(
	orgID int64,
	permissions map[string][]string,
) *user.SignedInUser {
	return &user.SignedInUser{
		UserID:  1,
		UserUID: "user-1",
		OrgID:   orgID,
		Permissions: map[int64]map[string][]string{
			orgID: permissions,
		},
	}
}

type legacyResolution struct {
	scopes []string
	err    error
}

type legacyResolverCase struct {
	name             string
	evaluator        accesscontrol.Evaluator
	permissions      map[string][]string
	resolutions      map[string]legacyResolution
	withoutResolvers bool
	allowed          bool
	wantErr          error
	wantCalls        []string
}

func legacyResolverCases() []legacyResolverCase {
	lookupErr := errors.New("resource lookup unavailable")
	return []legacyResolverCase{
		{
			name:      "wildcard grant avoids lookup of a missing resource",
			evaluator: accesscontrol.EvalPermission("dashboards:read", "dashboards:uid:missing"),
			permissions: map[string][]string{
				"dashboards:read": {"dashboards:*"},
			},
			resolutions: map[string]legacyResolution{
				"dashboards:uid:missing": {err: lookupErr},
			},
			allowed: true,
		},
		{
			name: "any checks the complete original expression before resolving",
			evaluator: accesscontrol.EvalAny(
				accesscontrol.EvalPermission("dashboards:read", "dashboards:uid:missing"),
				accesscontrol.EvalPermission("folders:read", "folders:uid:parent"),
			),
			permissions: map[string][]string{
				"folders:read": {"folders:uid:parent"},
			},
			resolutions: map[string]legacyResolution{
				"dashboards:uid:missing": {err: lookupErr},
			},
			allowed: true,
		},
		{
			name:      "inherited scope allows after direct denial",
			evaluator: accesscontrol.EvalPermission("dashboards:read", "dashboards:uid:dash-1"),
			permissions: map[string][]string{
				"dashboards:read": {"folders:uid:parent"},
			},
			resolutions: map[string]legacyResolution{
				"dashboards:uid:dash-1": {
					scopes: []string{"dashboards:uid:dash-1", "folders:uid:parent"},
				},
			},
			allowed:   true,
			wantCalls: []string{"dashboards:uid:dash-1"},
		},
		{
			name:      "missing resolver denies without an error",
			evaluator: accesscontrol.EvalPermission("folders:read", "folders:id:1"),
			permissions: map[string][]string{
				"folders:read": {"folders:uid:parent"},
			},
		},
		{
			name:      "resolver not found sentinel denies without an error",
			evaluator: accesscontrol.EvalPermission("dashboards:read", "dashboards:uid:dash-1"),
			permissions: map[string][]string{
				"dashboards:read": {"folders:uid:parent"},
			},
			resolutions: map[string]legacyResolution{
				"dashboards:uid:dash-1": {err: accesscontrol.ErrResolverNotFound},
			},
			wantCalls: []string{"dashboards:uid:dash-1"},
		},
		{
			name:      "lookup failure denies with an error",
			evaluator: accesscontrol.EvalPermission("dashboards:read", "dashboards:uid:dash-1"),
			permissions: map[string][]string{
				"dashboards:read": {"folders:uid:parent"},
			},
			resolutions: map[string]legacyResolution{
				"dashboards:uid:dash-1": {err: lookupErr},
			},
			wantErr:   lookupErr,
			wantCalls: []string{"dashboards:uid:dash-1"},
		},
		{
			name:      "WithoutResolvers does not look up inherited scopes",
			evaluator: accesscontrol.EvalPermission("dashboards:read", "dashboards:uid:dash-1"),
			permissions: map[string][]string{
				"dashboards:read": {"folders:uid:parent"},
			},
			withoutResolvers: true,
		},
		{
			name: "all preserves an unresolvable child while resolving another",
			evaluator: accesscontrol.EvalAll(
				accesscontrol.EvalPermission("folders:read", "folders:uid:parent"),
				accesscontrol.EvalPermission("dashboards:read", "dashboards:uid:dash-1"),
			),
			permissions: map[string][]string{
				"folders:read":    {"folders:uid:parent"},
				"dashboards:read": {"folders:uid:parent"},
			},
			resolutions: map[string]legacyResolution{
				"dashboards:uid:dash-1": {scopes: []string{"folders:uid:parent"}},
			},
			allowed:   true,
			wantCalls: []string{"dashboards:uid:dash-1"},
		},
		{
			name: "any resolves all children before evaluating the mutated expression",
			evaluator: accesscontrol.EvalAny(
				accesscontrol.EvalPermission("dashboards:read", "dashboards:uid:dash-1"),
				accesscontrol.EvalPermission("dashboards:read", "dashboards:uid:dash-2"),
			),
			permissions: map[string][]string{
				"dashboards:read": {"folders:uid:parent"},
			},
			resolutions: map[string]legacyResolution{
				"dashboards:uid:dash-1": {scopes: []string{"folders:uid:parent"}},
				"dashboards:uid:dash-2": {err: lookupErr},
			},
			wantErr:   lookupErr,
			wantCalls: []string{"dashboards:uid:dash-1", "dashboards:uid:dash-2"},
		},
		{
			name: "resolver failure stops mutation before the next child",
			evaluator: accesscontrol.EvalAll(
				accesscontrol.EvalPermission("dashboards:read", "dashboards:uid:dash-1"),
				accesscontrol.EvalPermission("dashboards:read", "dashboards:uid:dash-2"),
			),
			permissions: map[string][]string{
				"dashboards:read": {"folders:uid:parent"},
			},
			resolutions: map[string]legacyResolution{
				"dashboards:uid:dash-1": {err: lookupErr},
			},
			wantErr:   lookupErr,
			wantCalls: []string{"dashboards:uid:dash-1"},
		},
	}
}
