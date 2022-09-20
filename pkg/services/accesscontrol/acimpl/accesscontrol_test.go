package acimpl

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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
			ac := ProvideAccessControl(setting.NewCfg())

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

func TestAccessControl_EvaluateUserPermissions(t *testing.T) {
	testUser := func(opts ...func(*user.SignedInUser)) *user.SignedInUser {
		user := &user.SignedInUser{
			UserID:  1,
			OrgID:   1,
			OrgRole: "Viewer",
			Permissions: map[int64]map[string][]string{
				1: {
					"teams:read":  []string{"teams:*"},
					"teams:write": []string{"teams:id:1", "teams:id:2"},
				},
			},
		}
		for _, fn := range opts {
			fn(user)
		}
		return user
	}
	tests := []struct {
		name    string
		cmd     accesscontrol.EvaluateUserPermissionCommand
		want    map[string]accesscontrol.Metadata
		wantErr bool
	}{
		{
			name: "has action",
			cmd: accesscontrol.EvaluateUserPermissionCommand{
				SignedInUser: testUser(),
				Action:       "teams:read",
			},
			want:    map[string]accesscontrol.Metadata{"-": {"teams:read": true}},
			wantErr: false,
		},
		{
			name: "does not have action",
			cmd: accesscontrol.EvaluateUserPermissionCommand{
				SignedInUser: testUser(),
				Action:       "teams:delete",
			},
			want:    map[string]accesscontrol.Metadata{},
			wantErr: false,
		},
		{
			name: "get metadata",
			cmd: accesscontrol.EvaluateUserPermissionCommand{
				SignedInUser: testUser(),
				Resource:     "teams",
				Attribute:    "id",
				UIDs:         []string{"1", "3"},
			},
			want: map[string]accesscontrol.Metadata{
				"1": {"teams:read": true, "teams:write": true},
				"3": {"teams:read": true},
			},
			wantErr: false,
		},
		{
			name: "get metadata filter by action",
			cmd: accesscontrol.EvaluateUserPermissionCommand{
				SignedInUser: testUser(),
				Action:       "teams:write",
				Resource:     "teams",
				Attribute:    "id",
				UIDs:         []string{"1", "3"},
			},
			want: map[string]accesscontrol.Metadata{
				"1": {"teams:write": true},
			},
			wantErr: false,
		},
		{
			name: "no permissions",
			cmd: accesscontrol.EvaluateUserPermissionCommand{
				SignedInUser: testUser(func(siu *user.SignedInUser) { siu.Permissions = nil }),
			},
			want:    map[string]accesscontrol.Metadata{},
			wantErr: false,
		},
		{
			name: "missing filtering field",
			cmd: accesscontrol.EvaluateUserPermissionCommand{
				SignedInUser: testUser(),
				Action:       "teams:write",
				Resource:     "teams",
				UIDs:         []string{"1", "3"},
			},
			wantErr: true,
		},
		{
			name: "missing filtering field",
			cmd: accesscontrol.EvaluateUserPermissionCommand{
				SignedInUser: testUser(),
				Resource:     "teams",
				Attribute:    "id",
				UIDs:         []string{},
			},
			wantErr: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ac := ProvideAccessControl(setting.NewCfg())

			metadata, err := ac.EvaluateUserPermissions(context.Background(), tt.cmd)
			if tt.wantErr {
				require.Error(t, err)
			}
			require.EqualValues(t, tt.want, metadata)
		})
	}
}
