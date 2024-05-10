package acimpl_test

import (
	"context"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestAccessControl_Evaluate(t *testing.T) {
	type testCase struct {
		desc           string
		user           user.SignedInUser
		evaluator      accesscontrol.Evaluator
		resolverPrefix string
		expected       bool
		expectedErr    error
		scopeResolver  accesscontrol.ScopeAttributeResolver
		actionSets     map[string][]string
	}

	tests := []testCase{
		{
			desc: "expect user to have access when correct permission is stored on user",
			user: user.SignedInUser{
				OrgID: 1,
				Permissions: map[int64]map[string][]string{
					1: {accesscontrol.ActionTeamsWrite: {"teams:*"}},
				},
			},
			evaluator: accesscontrol.EvalPermission(accesscontrol.ActionTeamsWrite, "teams:id:1"),
			expected:  true,
		},
		{
			desc: "expect user to not have access without required permissions",
			user: user.SignedInUser{
				OrgID: 1,
				Permissions: map[int64]map[string][]string{
					1: {accesscontrol.ActionTeamsWrite: {"teams:*"}},
				},
			},
			evaluator: accesscontrol.EvalPermission(accesscontrol.ActionOrgUsersWrite, "users:id:1"),
			expected:  false,
		},
		{
			desc: "expect user to have access when resolver translate scope",
			user: user.SignedInUser{
				OrgID: 1,
				Permissions: map[int64]map[string][]string{
					1: {accesscontrol.ActionTeamsWrite: {"another:scope"}},
				},
			},
			evaluator:      accesscontrol.EvalPermission(accesscontrol.ActionTeamsWrite, "teams:id:1"),
			resolverPrefix: "teams:id:",
			scopeResolver: accesscontrol.ScopeAttributeResolverFunc(func(ctx context.Context, orgID int64, scope string) ([]string, error) {
				return []string{"another:scope"}, nil
			}),
			expected: true,
		},
		{
			desc: "expect user to have access when resolver translates actions to action sets",
			user: user.SignedInUser{
				OrgID: 1,
				Permissions: map[int64]map[string][]string{
					1: {"folders:edit": {"folders:uid:test_folder"}},
				},
			},
			evaluator: accesscontrol.EvalPermission(dashboards.ActionFoldersWrite, "folders:uid:test_folder"),
			actionSets: map[string][]string{
				"folders:edit": {dashboards.ActionFoldersWrite, dashboards.ActionFoldersRead, dashboards.ActionDashboardsWrite, dashboards.ActionDashboardsRead},
			},
			expected: true,
		},
		{
			desc: "expect user to have access when resolver translates scopes, as well as expands actions to action sets",
			user: user.SignedInUser{
				OrgID: 1,
				Permissions: map[int64]map[string][]string{
					1: {"folders:edit": {"folders:uid:test_folder"}},
				},
			},
			evaluator: accesscontrol.EvalPermission(dashboards.ActionDashboardsRead, "dashboards:uid:test_dashboard"),
			actionSets: map[string][]string{
				"folders:edit": {dashboards.ActionFoldersWrite, dashboards.ActionFoldersRead, dashboards.ActionDashboardsWrite, dashboards.ActionDashboardsRead},
			},
			resolverPrefix: "dashboards:uid:",
			scopeResolver: accesscontrol.ScopeAttributeResolverFunc(func(ctx context.Context, orgID int64, scope string) ([]string, error) {
				return []string{"folders:uid:test_folder"}, nil
			}),
			expected: true,
		},
		{
			desc: "expect user to have access with eval all evaluator when resolver translates scopes, as well as expands actions to action sets",
			user: user.SignedInUser{
				OrgID: 1,
				Permissions: map[int64]map[string][]string{
					1: {"folders:edit": {"folders:uid:test_folder"}},
				},
			},
			evaluator: accesscontrol.EvalAll(
				accesscontrol.EvalPermission(dashboards.ActionFoldersRead, "folders:uid:test_folder"),
				accesscontrol.EvalPermission(dashboards.ActionDashboardsWrite, "dashboards:uid:test_dashboard"),
			),
			actionSets: map[string][]string{
				"folders:edit": {dashboards.ActionFoldersWrite, dashboards.ActionFoldersRead, dashboards.ActionDashboardsWrite, dashboards.ActionDashboardsRead},
			},
			resolverPrefix: "dashboards:uid:",
			scopeResolver: accesscontrol.ScopeAttributeResolverFunc(func(ctx context.Context, orgID int64, scope string) ([]string, error) {
				return []string{"folders:uid:test_folder"}, nil
			}),
			expected: true,
		},
		{
			desc: "expect user to not have access with eval all evaluator with resolvers when not all permissions resolve to permissions that the user has",
			user: user.SignedInUser{
				OrgID: 1,
				Permissions: map[int64]map[string][]string{
					1: {"folders:edit": {"folders:uid:test_folder"}},
				},
			},
			evaluator: accesscontrol.EvalAll(
				accesscontrol.EvalPermission(dashboards.ActionDashboardsWrite, "datasources:uid:test_ds"),
				accesscontrol.EvalPermission(dashboards.ActionDashboardsWrite, "dashboards:uid:test_dashboard"),
			),
			actionSets: map[string][]string{
				"folders:edit": {dashboards.ActionFoldersWrite, dashboards.ActionFoldersRead, dashboards.ActionDashboardsWrite, dashboards.ActionDashboardsRead},
			},
			resolverPrefix: "dashboards:uid:",
			scopeResolver: accesscontrol.ScopeAttributeResolverFunc(func(ctx context.Context, orgID int64, scope string) ([]string, error) {
				return []string{"folders:uid:test_folder"}, nil
			}),
			expected: false,
		},
		{
			desc: "expect user to have access with eval any evaluator when resolver translates scopes, as well as expands actions to action sets",
			user: user.SignedInUser{
				OrgID: 1,
				Permissions: map[int64]map[string][]string{
					1: {"folders:edit": {"folders:uid:test_folder"}},
				},
			},
			evaluator: accesscontrol.EvalAny(
				accesscontrol.EvalPermission(dashboards.ActionDashboardsDelete, "dashboards:uid:test_dashboard"),
				accesscontrol.EvalPermission(dashboards.ActionDashboardsWrite, "dashboards:uid:test_dashboard"),
			),
			actionSets: map[string][]string{
				"folders:edit": {dashboards.ActionFoldersWrite, dashboards.ActionFoldersRead, dashboards.ActionDashboardsWrite, dashboards.ActionDashboardsRead},
			},
			resolverPrefix: "dashboards:uid:",
			scopeResolver: accesscontrol.ScopeAttributeResolverFunc(func(ctx context.Context, orgID int64, scope string) ([]string, error) {
				return []string{"folders:uid:test_folder"}, nil
			}),
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			ac := acimpl.ProvideAccessControl(featuremgmt.WithFeatures(featuremgmt.FlagAccessActionSets))

			if tt.scopeResolver != nil {
				ac.RegisterScopeAttributeResolver(tt.resolverPrefix, tt.scopeResolver)
			}

			if tt.actionSets != nil {
				actionSetResolver := resourcepermissions.NewActionSetService(ac)
				for actionSet, actions := range tt.actionSets {
					splitActionSet := strings.Split(actionSet, ":")
					actionSetResolver.StoreActionSet(splitActionSet[0], splitActionSet[1], actions)
				}
				ac.RegisterActionResolver(actionSetResolver)
			}

			hasAccess, err := ac.Evaluate(context.Background(), &tt.user, tt.evaluator)
			assert.Equal(t, tt.expected, hasAccess)
			if tt.expectedErr != nil {
				assert.Equal(t, tt.expectedErr, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}
