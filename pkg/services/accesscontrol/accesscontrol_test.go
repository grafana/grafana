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
	tests := []struct {
		name        string
		permissions []Permission
		expected    map[string][]string
	}{
		{
			name:        "empty permissions",
			permissions: []Permission{},
			expected:    map[string][]string{},
		},
		{
			name:        "single action single scope",
			permissions: []Permission{{Action: "read", Scope: "dashboards:1"}},
			expected:    map[string][]string{"read": {"dashboards:1"}},
		},
		{
			name: "single action multiple scopes preserves order",
			permissions: []Permission{
				{Action: "read", Scope: "a"},
				{Action: "read", Scope: "b"},
				{Action: "read", Scope: "c"},
			},
			expected: map[string][]string{"read": {"a", "b", "c"}},
		},
		{
			name: "multiple actions interleaved preserves order per action",
			permissions: []Permission{
				{Action: "read", Scope: "r1"},
				{Action: "write", Scope: "w1"},
				{Action: "read", Scope: "r2"},
				{Action: "write", Scope: "w2"},
			},
			expected: map[string][]string{
				"read":  {"r1", "r2"},
				"write": {"w1", "w2"},
			},
		},
		{
			name: "duplicate scopes preserved",
			permissions: []Permission{
				{Action: "read", Scope: "same"},
				{Action: "read", Scope: "same"},
			},
			expected: map[string][]string{"read": {"same", "same"}},
		},
		{
			name:        "empty scope string",
			permissions: []Permission{{Action: "admin", Scope: ""}},
			expected:    map[string][]string{"admin": {""}},
		},
		{
			name: "many actions one scope each",
			permissions: []Permission{
				{Action: "a1", Scope: "s1"},
				{Action: "a2", Scope: "s2"},
				{Action: "a3", Scope: "s3"},
				{Action: "a4", Scope: "s4"},
				{Action: "a5", Scope: "s5"},
			},
			expected: map[string][]string{
				"a1": {"s1"},
				"a2": {"s2"},
				"a3": {"s3"},
				"a4": {"s4"},
				"a5": {"s5"},
			},
		},
		{
			name: "multiple actions with varying scope counts",
			permissions: func() []Permission {
				var perms []Permission
				for i := 0; i < 3; i++ {
					for j := 0; j < 2+i; j++ {
						perms = append(perms, Permission{
							Action: fmt.Sprintf("action:%d", i),
							Scope:  fmt.Sprintf("scope:%d_%d", i, j),
						})
					}
				}
				return perms
			}(),
			expected: map[string][]string{
				"action:0": {"scope:0_0", "scope:0_1"},
				"action:1": {"scope:1_0", "scope:1_1", "scope:1_2"},
				"action:2": {"scope:2_0", "scope:2_1", "scope:2_2", "scope:2_3"},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := GroupScopesByActionContext(context.Background(), tt.permissions)
			assert.Equal(t, len(tt.expected), len(result), "map length mismatch")
			for action, expectedScopes := range tt.expected {
				actualScopes, ok := result[action]
				assert.True(t, ok, "missing action: %s", action)
				assert.Equal(t, expectedScopes, actualScopes, "scopes mismatch for action: %s", action)
			}
		})
	}
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

// BenchmarkGroupScopesByActionMemory benchmarks memory allocations for GroupScopesByActionContext.
// Run with: go test -bench=BenchmarkGroupScopesByActionMemory -benchmem -run=^$ ./pkg/services/accesscontrol/
func BenchmarkGroupScopesByActionMemory(b *testing.B) {
	testCases := []struct {
		name       string
		numActions int
		totalPerms int
	}{
		// Small: typical single user
		{"small_10actions_1k", 10, 1_000},
		// Medium: power user with many dashboards
		{"medium_50actions_10k", 50, 10_000},
		// Large: enterprise user with extensive permissions
		{"large_100actions_70k", 100, 70_000},
		// XLarge: simulates large instance scenarios (closer to production profiles)
		{"xlarge_200actions_500k", 200, 500_000},
		// XXLarge: stress test for very large permission sets
		{"xxlarge_500actions_1m", 500, 1_000_000},
	}

	for _, tc := range testCases {
		b.Run(tc.name, func(b *testing.B) {
			permissions := generateTestPermissions(tc.numActions, tc.totalPerms)

			b.ReportAllocs()
			b.ReportMetric(float64(len(permissions)), "permissions")
			b.ReportMetric(float64(tc.numActions), "actions")
			b.ResetTimer()

			for b.Loop() {
				GroupScopesByActionContext(context.Background(), permissions)
			}
		})
	}
}

// generateTestPermissions creates a slice of permissions with realistic distribution.
// Some actions have more scopes than others to simulate real-world usage patterns.
func generateTestPermissions(numActions, totalPerms int) []Permission {
	permissions := make([]Permission, 0, totalPerms)

	// Calculate base scopes per action
	basePerAction := totalPerms / numActions
	if basePerAction < 1 {
		basePerAction = 1
	}

	for i := 0; i < numActions && len(permissions) < totalPerms; i++ {
		// Add variance: some actions get 2x scopes, some get 0.5x
		scopeCount := basePerAction
		if i%3 == 0 {
			scopeCount = scopeCount * 2
		} else if i%5 == 0 {
			scopeCount = scopeCount / 2
		}

		for j := 0; j < scopeCount && len(permissions) < totalPerms; j++ {
			permissions = append(permissions, Permission{
				Action: fmt.Sprintf("action:%d", i),
				Scope:  fmt.Sprintf("dashboards:uid:%d_%d", i, j),
			})
		}
	}

	// Fill remaining if distribution didn't cover all
	for len(permissions) < totalPerms {
		idx := len(permissions) % numActions
		permissions = append(permissions, Permission{
			Action: fmt.Sprintf("action:%d", idx),
			Scope:  fmt.Sprintf("dashboards:uid:extra_%d", len(permissions)),
		})
	}

	return permissions
}
