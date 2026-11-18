package acimpl_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/user"
)

type accessControlEvaluateTestCase struct {
	desc           string
	user           user.SignedInUser
	action         string
	scope          string
	resolverPrefix string
	expected       bool
	expectedErr    error
	scopeResolver  accesscontrol.ScopeAttributeResolver
}

var accessControlEvaluateTestCases = []accessControlEvaluateTestCase{
	{
		desc: "expect user to have access when correct permission is stored on user",
		user: user.SignedInUser{
			UserID:  1,
			UserUID: "user-1",
			OrgID:   1,
			Permissions: map[int64]map[string][]string{
				1: {accesscontrol.ActionTeamsWrite: {"teams:*"}},
			},
		},
		action:   accesscontrol.ActionTeamsWrite,
		scope:    "teams:id:1",
		expected: true,
	},
	{
		desc: "expect user to not have access without required permissions",
		user: user.SignedInUser{
			UserID:  1,
			UserUID: "user-1",
			OrgID:   1,
			Permissions: map[int64]map[string][]string{
				1: {accesscontrol.ActionTeamsWrite: {"teams:*"}},
			},
		},
		action:   accesscontrol.ActionOrgUsersWrite,
		scope:    "users:id:1",
		expected: false,
	},
	{
		desc: "expect user to have access when resolver translate scope",
		user: user.SignedInUser{
			UserID:  1,
			UserUID: "user-1",
			OrgID:   1,
			Permissions: map[int64]map[string][]string{
				1: {accesscontrol.ActionTeamsWrite: {"another:scope"}},
			},
		},
		action:         accesscontrol.ActionTeamsWrite,
		scope:          "teams:id:1",
		resolverPrefix: "teams:id:",
		scopeResolver: accesscontrol.ScopeAttributeResolverFunc(func(ctx context.Context, orgID int64, scope string) ([]string, error) {
			return []string{"another:scope"}, nil
		}),
		expected: true,
	},
}

func TestAccessControl_Evaluate(t *testing.T) {
	for _, tt := range accessControlEvaluateTestCases {
		t.Run(tt.desc, func(t *testing.T) {
			ac := acimpl.ProvideAccessControl(featuremgmt.WithFeatures())

			if tt.scopeResolver != nil {
				ac.RegisterScopeAttributeResolver(tt.resolverPrefix, tt.scopeResolver)
			}

			hasAccess, err := ac.Evaluate(context.Background(), &tt.user, accesscontrol.EvalPermission(tt.action, tt.scope))
			assert.Equal(t, tt.expected, hasAccess)
			if tt.expectedErr != nil {
				assert.Equal(t, tt.expectedErr, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}
