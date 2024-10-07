package accesscontrol

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	// this import is needed for github.com/grafana/grafana/pkg/web hack_wrap to work
	_ "github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestReduce(t *testing.T) {
	tests := []struct {
		name string
		ps   []Permission
		want map[string][]string
	}{
		{
			name: "no permission",
			ps:   []Permission{},
			want: map[string][]string{},
		},
		{
			name: "scopeless permissions",
			ps:   []Permission{{Action: "orgs:read"}},
			want: map[string][]string{"orgs:read": nil},
		},
		{ // edge case that should not exist
			name: "mixed scope and scopeless permissions",
			ps: []Permission{
				{Action: "resources:read", Scope: "resources:id:1"},
				{Action: "resources:read"},
			},
			want: map[string][]string{"resources:read": {"resources:id:1"}},
		},
		{
			name: "specific permission",
			ps: []Permission{
				{Action: "teams:read", Scope: "teams:id:1"},
				{Action: "teams:read", Scope: "teams:id:2"},
				{Action: "teams:write", Scope: "teams:id:1"},
			},
			want: map[string][]string{
				"teams:read":  {"teams:id:1", "teams:id:2"},
				"teams:write": {"teams:id:1"},
			},
		},
		{
			name: "specific permissions with repeated scope",
			ps: []Permission{
				{Action: "teams:read", Scope: "teams:id:1"},
				{Action: "teams:read", Scope: "teams:id:2"},
				{Action: "teams:read", Scope: "teams:id:1"},
			},
			want: map[string][]string{
				"teams:read": {"teams:id:1", "teams:id:2"},
			},
		},
		{
			name: "wildcard permission",
			ps: []Permission{
				{Action: "teams:read", Scope: "teams:id:1"},
				{Action: "teams:read", Scope: "teams:id:2"},
				{Action: "teams:read", Scope: "teams:id:*"},
				{Action: "teams:write", Scope: "teams:id:1"},
			},
			want: map[string][]string{
				"teams:read":  {"teams:id:*"},
				"teams:write": {"teams:id:1"},
			},
		},
		{
			name: "mixed wildcard and scoped permission",
			ps: []Permission{
				{Action: "dashboards:read", Scope: "dashboards:*"},
				{Action: "dashboards:read", Scope: "folders:uid:1"},
			},
			want: map[string][]string{
				"dashboards:read": {"dashboards:*", "folders:uid:1"},
			},
		},
		{
			name: "different wildcard permission",
			ps: []Permission{
				{Action: "dashboards:read", Scope: "dashboards:uid:*"},
				{Action: "dashboards:read", Scope: "dashboards:*"},
				{Action: "dashboards:read", Scope: "folders:uid:*"},
				{Action: "dashboards:read", Scope: "folders:*"},
			},
			want: map[string][]string{
				"dashboards:read": {"dashboards:*", "folders:*"},
			},
		},
		{
			name: "root wildcard permission",
			ps: []Permission{
				{Action: "dashboards:read", Scope: "*"},
				{Action: "dashboards:read", Scope: "dashboards:*"},
				{Action: "dashboards:read", Scope: "folders:*"},
			},
			want: map[string][]string{
				"dashboards:read": {"*"},
			},
		},
		{
			name: "non-wilcard scopes with * in them",
			ps: []Permission{
				{Action: "dashboards:read", Scope: "dashboards:uid:123"},
				{Action: "dashboards:read", Scope: "dashboards:uid:1*"},
			},
			want: map[string][]string{
				"dashboards:read": {"dashboards:uid:123", "dashboards:uid:1*"},
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := Reduce(tt.ps)
			require.Len(t, got, len(tt.want))
			for action, scopes := range got {
				want, ok := tt.want[action]
				require.True(t, ok)
				require.ElementsMatch(t, scopes, want)
			}
		})
	}
}

func TestGetOrgRoles(t *testing.T) {
	testCases := []struct {
		desc               string
		user               *user.SignedInUser
		elevateServerAdmin bool
		result             []string
	}{
		{
			desc: "basic role only",
			user: &user.SignedInUser{
				OrgID:   1,
				OrgRole: org.RoleViewer,
			},
			elevateServerAdmin: false,
			result:             []string{string(org.RoleViewer)},
		},
		{
			desc: "server admin non-elevated",
			user: &user.SignedInUser{
				OrgID:          1,
				OrgRole:        org.RoleViewer,
				IsGrafanaAdmin: true,
			},
			elevateServerAdmin: false,
			result:             []string{RoleGrafanaAdmin, string(org.RoleViewer)},
		},
		{
			desc: "server admin global org",
			user: &user.SignedInUser{
				OrgID:          GlobalOrgID,
				IsGrafanaAdmin: true,
			},
			elevateServerAdmin: false,
			result:             []string{RoleGrafanaAdmin, string(org.RoleAdmin)},
		},
		{
			desc: "server admin elevated non-member",
			user: &user.SignedInUser{
				OrgID:          2,
				OrgRole:        org.RoleNone,
				IsGrafanaAdmin: true,
			},
			elevateServerAdmin: true,
			result:             []string{RoleGrafanaAdmin, string(org.RoleAdmin)},
		},
		{
			desc: "server admin elevated member",
			user: &user.SignedInUser{
				OrgID:          2,
				OrgRole:        org.RoleViewer,
				IsGrafanaAdmin: true,
			},
			elevateServerAdmin: true,
			result:             []string{RoleGrafanaAdmin, string(org.RoleAdmin)},
		},
	}

	for _, tt := range testCases {
		t.Run(tt.desc, func(t *testing.T) {
			orgRoles := GetOrgRoles(tt.user, tt.elevateServerAdmin)
			assert.ElementsMatch(t, tt.result, orgRoles)
		})
	}
}

func TestGroupScopesByActionContext(t *testing.T) {
	// test data = 3 actions with 2+i scopes each, including a duplicate
	permissions := []Permission{}
	for i := 0; i < 3; i++ {
		for j := 0; j < 2+i; j++ {
			permissions = append(permissions, Permission{
				Action: fmt.Sprintf("action:%d", i),
				Scope:  fmt.Sprintf("scope:%d_%d", i, j),
			})
		}
	}

	expected := map[string][]string{}
	for i := 0; i < 3; i++ {
		action := fmt.Sprintf("action:%d", i)
		scopes := []string{}
		for j := 0; j < 2+i; j++ {
			scopes = append(scopes, fmt.Sprintf("scope:%d_%d", i, j))
		}
		expected[action] = scopes
	}

	assert.EqualValues(t, expected, GroupScopesByActionContext(context.Background(), permissions))
}

func BenchmarkGroupScopesByAction(b *testing.B) {
	// create a big list of permissions with a bunch of duplicates
	permissions := []Permission{}
	for i := 0; i < 100; i++ {
		for j := 0; j < 500+i; j++ {
			permissions = append(permissions, Permission{
				Action: fmt.Sprintf("action:%d", i),
				Scope:  fmt.Sprintf("scope:%d_%d", i, j),
			})
		}
		// add duplicate scopes
		for j := 0; j < 10; j++ {
			permissions = append(permissions, Permission{
				Action: fmt.Sprintf("action:%d", i),
				Scope:  fmt.Sprintf("scope:%d_%d", i, 0),
			})
		}
	}

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		GroupScopesByActionContext(context.Background(), permissions)
	}
}
