package resourcepermission

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestMergeDefaultPermissions(t *testing.T) {
	defaults := []map[string]any{
		{"kind": "BasicRole", "name": "Editor", "verb": "edit"},
		{"kind": "BasicRole", "name": "Viewer", "verb": "view"},
	}

	tests := []struct {
		name        string
		current     []any
		want        []any
		wantChanged bool
	}{
		{
			name:    "no existing permissions returns the defaults",
			current: nil,
			want: []any{
				map[string]any{"kind": "BasicRole", "name": "Editor", "verb": "edit"},
				map[string]any{"kind": "BasicRole", "name": "Viewer", "verb": "view"},
			},
			wantChanged: true,
		},
		{
			name: "existing grants are kept and only missing defaults are added",
			current: []any{
				map[string]any{"kind": "User", "name": "someone-else", "verb": "admin"},
				map[string]any{"kind": "BasicRole", "name": "Editor", "verb": "admin"},
			},
			want: []any{
				map[string]any{"kind": "User", "name": "someone-else", "verb": "admin"},
				map[string]any{"kind": "BasicRole", "name": "Editor", "verb": "admin"},
				map[string]any{"kind": "BasicRole", "name": "Viewer", "verb": "view"},
			},
			wantChanged: true,
		},
		{
			name: "nothing changes when every default subject already has a grant",
			current: []any{
				map[string]any{"kind": "BasicRole", "name": "Viewer", "verb": "edit"},
				map[string]any{"kind": "BasicRole", "name": "Editor", "verb": "edit"},
			},
			want: []any{
				map[string]any{"kind": "BasicRole", "name": "Viewer", "verb": "edit"},
				map[string]any{"kind": "BasicRole", "name": "Editor", "verb": "edit"},
			},
			wantChanged: false,
		},
		{
			name:    "malformed entries are dropped",
			current: []any{"not-a-map", map[string]any{"kind": "Team", "name": "team-a", "verb": "view"}},
			want: []any{
				map[string]any{"kind": "Team", "name": "team-a", "verb": "view"},
				map[string]any{"kind": "BasicRole", "name": "Editor", "verb": "edit"},
				map[string]any{"kind": "BasicRole", "name": "Viewer", "verb": "view"},
			},
			wantChanged: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, changed := MergeDefaultPermissions(tt.current, defaults)
			require.Equal(t, tt.want, got)
			require.Equal(t, tt.wantChanged, changed)
		})
	}
}
