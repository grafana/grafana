package accesscontrol

import (
	"fmt"
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

func TestIntersect(t *testing.T) {
	tests := []struct {
		name string
		p1   []Permission
		p2   []Permission
		want map[string][]string
	}{
		{
			name: "no permission",
			p1:   []Permission{},
			p2:   []Permission{},
			want: map[string][]string{},
		},
		{
			name: "no intersection",
			p1:   []Permission{{Action: "orgs:read"}},
			p2:   []Permission{{Action: "orgs:write"}},
			want: map[string][]string{},
		},
		{
			name: "intersection no scopes",
			p1:   []Permission{{Action: "orgs:read"}},
			p2:   []Permission{{Action: "orgs:read"}},
			want: map[string][]string{"orgs:read": {}},
		},
		{
			name: "unbalanced intersection",
			p1:   []Permission{{Action: "teams:read", Scope: "teams:id:1"}},
			p2:   []Permission{{Action: "teams:read"}},
			want: map[string][]string{"teams:read": {}},
		},
		{
			name: "intersection",
			p1: []Permission{
				{Action: "teams:read", Scope: "teams:id:1"},
				{Action: "teams:read", Scope: "teams:id:2"},
				{Action: "teams:write", Scope: "teams:id:1"},
			},
			p2: []Permission{
				{Action: "teams:read", Scope: "teams:id:1"},
				{Action: "teams:read", Scope: "teams:id:3"},
				{Action: "teams:write", Scope: "teams:id:1"},
			},
			want: map[string][]string{
				"teams:read":  {"teams:id:1"},
				"teams:write": {"teams:id:1"},
			},
		},
		{
			name: "intersection with wildcards",
			p1: []Permission{
				{Action: "teams:read", Scope: "teams:id:1"},
				{Action: "teams:read", Scope: "teams:id:2"},
				{Action: "teams:write", Scope: "teams:id:1"},
			},
			p2: []Permission{
				{Action: "teams:read", Scope: "*"},
				{Action: "teams:write", Scope: "*"},
			},
			want: map[string][]string{
				"teams:read":  {"teams:id:1", "teams:id:2"},
				"teams:write": {"teams:id:1"},
			},
		},
		{
			name: "intersection with wildcards on both sides",
			p1: []Permission{
				{Action: "dashboards:read", Scope: "dashboards:uid:1"},
				{Action: "dashboards:read", Scope: "folders:uid:1"},
				{Action: "dashboards:read", Scope: "dashboards:uid:*"},
				{Action: "folders:read", Scope: "folders:uid:1"},
			},
			p2: []Permission{
				{Action: "dashboards:read", Scope: "folders:uid:*"},
				{Action: "dashboards:read", Scope: "dashboards:uid:*"},
				{Action: "folders:read", Scope: "folders:uid:*"},
			},
			want: map[string][]string{
				"dashboards:read": {"dashboards:uid:*", "folders:uid:1"},
				"folders:read":    {"folders:uid:1"},
			},
		},
		{
			name: "intersection with wildcards of different sizes",
			p1: []Permission{
				{Action: "dashboards:read", Scope: "folders:uid:1"},
				{Action: "dashboards:read", Scope: "dashboards:*"},
				{Action: "folders:read", Scope: "folders:*"},
				{Action: "teams:read", Scope: "teams:id:1"},
			},
			p2: []Permission{
				{Action: "dashboards:read", Scope: "folders:uid:*"},
				{Action: "dashboards:read", Scope: "dashboards:uid:*"},
				{Action: "folders:read", Scope: "folders:uid:*"},
				{Action: "teams:read", Scope: "*"},
			},
			want: map[string][]string{
				"dashboards:read": {"dashboards:uid:*", "folders:uid:1"},
				"folders:read":    {"folders:uid:*"},
				"teams:read":      {"teams:id:1"},
			},
		},
	}
	check := func(t *testing.T, want map[string][]string, p1, p2 []Permission) {
		intersect := Intersect(p1, p2)
		for action, scopes := range intersect {
			want, ok := want[action]
			require.True(t, ok)
			require.ElementsMatch(t, scopes, want, fmt.Sprintf("scopes for %v differs from expected", action))
		}
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Intersect is commutative
			check(t, tt.want, tt.p1, tt.p2)
			check(t, tt.want, tt.p2, tt.p1)
		})
	}
}

func Test_intersectScopes(t *testing.T) {
	tests := []struct {
		name string
		s1   []string
		s2   []string
		want []string
	}{
		{
			name: "no values",
			s1:   []string{},
			s2:   []string{},
			want: []string{},
		},
		{
			name: "no values on one side",
			s1:   []string{},
			s2:   []string{"teams:id:1"},
			want: []string{},
		},
		{
			name: "empty values on one side",
			s1:   []string{""},
			s2:   []string{"team:id:1"},
			want: []string{},
		},
		{
			name: "no intersection",
			s1:   []string{"teams:id:1"},
			s2:   []string{"teams:id:2"},
			want: []string{},
		},
		{
			name: "intersection",
			s1:   []string{"teams:id:1"},
			s2:   []string{"teams:id:1"},
			want: []string{"teams:id:1"},
		},
		{
			name: "intersection with wildcard",
			s1:   []string{"teams:id:1", "teams:id:2"},
			s2:   []string{"teams:id:*"},
			want: []string{"teams:id:1", "teams:id:2"},
		},
		{
			name: "intersection of wildcards",
			s1:   []string{"teams:id:*"},
			s2:   []string{"teams:id:*"},
			want: []string{"teams:id:*"},
		},
		{
			name: "intersection with a bigger wildcards",
			s1:   []string{"teams:id:*"},
			s2:   []string{"teams:*"},
			want: []string{"teams:id:*"},
		},
		{
			name: "intersection of different wildcards with a bigger one",
			s1:   []string{"dashboards:uid:*", "folders:uid:*"},
			s2:   []string{"*"},
			want: []string{"dashboards:uid:*", "folders:uid:*"},
		},
		{
			name: "intersection with wildcards and scopes on both sides",
			s1:   []string{"dashboards:uid:*", "folders:uid:1"},
			s2:   []string{"folders:uid:*", "dashboards:uid:1"},
			want: []string{"dashboards:uid:1", "folders:uid:1"},
		},
		{
			name: "intersection of non reduced list of scopes",
			s1:   []string{"dashboards:uid:*", "dashboards:*", "dashboards:uid:1"},
			s2:   []string{"dashboards:uid:*", "dashboards:*", "dashboards:uid:2"},
			want: []string{"dashboards:uid:*", "dashboards:*", "dashboards:uid:1", "dashboards:uid:2"},
		},
	}
	check := func(t *testing.T, want []string, s1, s2 []string) {
		intersect := intersectScopes(s1, s2)
		require.ElementsMatch(t, want, intersect)
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Intersect is commutative
			check(t, tt.want, tt.s1, tt.s2)
			check(t, tt.want, tt.s2, tt.s1)
		})
	}
}
