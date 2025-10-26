package accesscontrol

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	// this import is needed for github.com/grafana/grafana/pkg/web hack_wrap to work
	_ "github.com/grafana/grafana/pkg/api/response"
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
	testCases := []struct {
		name         string
		numActions   int
		totalPerms   int
		avgPerAction int
	}{
		{"small", 10, 1000, 100},
		{"medium", 50, 10000, 200},
		{"large", 100, 70000, 700},
	}

	for _, tc := range testCases {
		b.Run(tc.name, func(b *testing.B) {
			permissions := make([]Permission, 0, tc.totalPerms)

			// Create realistic distribution with variance
			// Some actions have more scopes than others
			for i := 0; i < tc.numActions; i++ {
				// Add variance: some actions get more scopes
				scopeCount := tc.avgPerAction
				if i%3 == 0 {
					scopeCount = scopeCount * 2
				} else if i%5 == 0 {
					scopeCount = scopeCount / 2
				}

				for j := 0; j < scopeCount && len(permissions) < tc.totalPerms; j++ {
					permissions = append(permissions, Permission{
						Action: fmt.Sprintf("action:%d", i),
						Scope:  fmt.Sprintf("scope:%d_%d", i, j),
					})
				}
			}

			b.ReportMetric(float64(len(permissions)), "permissions")
			b.ReportMetric(float64(tc.numActions), "actions")
			b.ResetTimer()

			for b.Loop() {
				GroupScopesByActionContext(context.Background(), permissions)
			}
		})
	}
}
