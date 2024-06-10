package accesscontrol

import (
	"testing"

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
