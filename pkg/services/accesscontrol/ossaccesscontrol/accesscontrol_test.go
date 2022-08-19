package ossaccesscontrol

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
)

func TestAccessControl_Evaluate(t *testing.T) {
	type testCase struct {
		desc           string
		user           user.SignedInUser
		evaluator      accesscontrol.Evaluator
		resolverPrefix string
		expected       bool
		expectedErr    error
		resolver       accesscontrol.ScopeAttributeResolver
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
			resolver: accesscontrol.ScopeAttributeResolverFunc(func(ctx context.Context, orgID int64, scope string) ([]string, error) {
				return []string{"another:scope"}, nil
			}),
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			fakeService := actest.FakeService{}
			ac := ProvideAccessControl(setting.NewCfg(), fakeService)

			if tt.resolver != nil {
				ac.RegisterScopeAttributeResolver(tt.resolverPrefix, tt.resolver)
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
