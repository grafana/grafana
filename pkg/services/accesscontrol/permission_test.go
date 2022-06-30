package accesscontrol

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestOptimizeScopes(t *testing.T) {
	type testCase struct {
		desc string
		in   []Permission
		out  []Permission
	}

	tests := []testCase{
		{
			desc: "Should only return wildcard scope",
			in: []Permission{
				{Action: "dashboards:read", Scope: "dashboards:*"},
				{Action: "dashboards:read", Scope: "dashboards:uid:5"},
				{Action: "dashboards:read", Scope: "dashboards:uid:10"},
				{Action: "dashboards:read", Scope: "dashboards:uid:22"},
				{Action: "dashboards:read", Scope: "dashboards:uid:999"},
			},
			out: []Permission{
				{Action: "dashboards:read", Scope: "dashboards:*"},
			},
		},
		{
			desc: "Should only return wildcard scope for read action",
			in: []Permission{
				{Action: "dashboards:read", Scope: "dashboards:*"},
				{Action: "dashboards:read", Scope: "dashboards:uid:5"},
				{Action: "dashboards:read", Scope: "dashboards:uid:10"},
				{Action: "dashboards:read", Scope: "dashboards:uid:22"},
				{Action: "dashboards:read", Scope: "dashboards:uid:999"},
				{Action: "dashboards:write", Scope: "dashboards:uid:5"},
				{Action: "dashboards:write", Scope: "dashboards:uid:10"},
			},
			out: []Permission{
				{Action: "dashboards:read", Scope: "dashboards:*"},
				{Action: "dashboards:write", Scope: "dashboards:uid:5"},
				{Action: "dashboards:write", Scope: "dashboards:uid:10"},
			},
		},
		{
			desc: "Should keep scopes with different prefix than wildcard scope",
			in: []Permission{
				{Action: "dashboards:read", Scope: "dashboards:*"},
				{Action: "dashboards:read", Scope: "dashboards:uid:5"},
				{Action: "dashboards:read", Scope: "dashboards:uid:10"},
				{Action: "dashboards:read", Scope: "dashboards:uid:22"},
				{Action: "dashboards:read", Scope: "folders:uid:1"},
			},
			out: []Permission{
				{Action: "dashboards:read", Scope: "dashboards:*"},
				{Action: "dashboards:read", Scope: "folders:uid:1"},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			out := ReducePermissions(tt.in)
			require.Equal(t, tt.out, out)
		})
	}
}
