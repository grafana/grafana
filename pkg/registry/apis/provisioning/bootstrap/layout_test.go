package bootstrap

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	claims "github.com/grafana/authlib/types"
)

// onPrem is the namespace mapper used on-prem: org 1 is "default", the rest are "org-N".
var onPrem = claims.OrgNamespaceFormatter

func TestLayoutResolve(t *testing.T) {
	tests := []struct {
		name        string
		path        string
		orgsRoot    bool
		dirs        []string
		files       []string
		orgIDs      []int64
		namespacer  func(int64) string
		want        []Config
		wantUnknown []string
		wantErr     bool
	}{
		{
			name:   "bootstrap_path provisions only the default org",
			path:   "/etc/grafana/bootstrap",
			orgIDs: []int64{1, 2},
			want: []Config{
				{Path: "/etc/grafana/bootstrap", Namespace: "default"},
				{Namespace: "org-2"},
			},
		},
		{
			// auto_assign_org_id can name an org that does not exist yet.
			name:   "bootstrap_path provisions the default org even when it has no record",
			path:   "/etc/grafana/bootstrap",
			orgIDs: []int64{2},
			want: []Config{
				{Namespace: "org-2"},
				{Path: "/etc/grafana/bootstrap", Namespace: "default"},
			},
		},
		{
			name:     "one repository per org with a directory",
			orgsRoot: true,
			dirs:     []string{"1", "2"},
			orgIDs:   []int64{1, 2},
			want: []Config{
				{Path: "1", Namespace: "default"},
				{Path: "2", Namespace: "org-2"},
			},
		},
		{
			// An empty path still reconciles, so a repository an earlier run registered is removed.
			name:     "an org without a directory gets no path",
			orgsRoot: true,
			dirs:     []string{"2"},
			orgIDs:   []int64{1, 2},
			want: []Config{
				{Namespace: "default"},
				{Path: "2", Namespace: "org-2"},
			},
		},
		{
			name:        "reports entries that name no org",
			orgsRoot:    true,
			dirs:        []string{"1", "org-2", "7"},
			files:       []string{"dashboard.json"},
			orgIDs:      []int64{1, 2},
			want:        []Config{{Path: "1", Namespace: "default"}, {Namespace: "org-2"}},
			wantUnknown: []string{"7", "dashboard.json", "org-2"},
		},
		{
			name:        "a file named after an org is not its directory",
			orgsRoot:    true,
			files:       []string{"1"},
			orgIDs:      []int64{1},
			want:        []Config{{Namespace: "default"}},
			wantUnknown: []string{"1"},
		},
		{
			name:       "collapses orgs that share a namespace",
			orgsRoot:   true,
			dirs:       []string{"2"},
			orgIDs:     []int64{1, 2},
			namespacer: func(int64) string { return "stacks-7" },
			want:       []Config{{Path: "2", Namespace: "stacks-7"}},
		},
		{
			name:       "rejects two directories mapping to the same namespace",
			orgsRoot:   true,
			dirs:       []string{"1", "2"},
			orgIDs:     []int64{1, 2},
			namespacer: func(int64) string { return "stacks-7" },
			wantErr:    true,
		},
		{
			name:   "nothing configured removes every org's repository",
			orgIDs: []int64{1, 2},
			want:   []Config{{Namespace: "default"}, {Namespace: "org-2"}},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			layout := Layout{Path: tt.path, DefaultOrgID: 1}
			if tt.orgsRoot {
				layout.OrgsRoot = t.TempDir()
			}
			for _, dir := range tt.dirs {
				require.NoError(t, os.Mkdir(filepath.Join(layout.OrgsRoot, dir), 0o700))
			}
			for _, file := range tt.files {
				require.NoError(t, os.WriteFile(filepath.Join(layout.OrgsRoot, file), []byte("{}"), 0o600))
			}

			namespacer := tt.namespacer
			if namespacer == nil {
				namespacer = onPrem
			}

			got, unknown, err := layout.Resolve(tt.orgIDs, namespacer)
			if tt.wantErr {
				assert.Error(t, err)
				return
			}
			require.NoError(t, err)

			want := make([]Config, 0, len(tt.want))
			for _, cfg := range tt.want {
				if tt.orgsRoot && cfg.Path != "" {
					cfg.Path = filepath.Join(layout.OrgsRoot, cfg.Path)
				}
				want = append(want, cfg)
			}
			assert.Equal(t, want, got)
			assert.Equal(t, tt.wantUnknown, unknown)
		})
	}

	t.Run("a missing orgs root removes every org's repository", func(t *testing.T) {
		layout := Layout{OrgsRoot: filepath.Join(t.TempDir(), "absent"), DefaultOrgID: 1}
		got, unknown, err := layout.Resolve([]int64{1, 2}, onPrem)
		require.NoError(t, err)
		assert.Equal(t, []Config{{Namespace: "default"}, {Namespace: "org-2"}}, got)
		assert.Empty(t, unknown)
	})
}

func TestLayoutPermittedPaths(t *testing.T) {
	assert.Empty(t, Layout{HomePath: "/usr/share/grafana"}.PermittedPaths())

	// Both are permitted, so a run that switches between them does not need the prefixes
	// changed as well.
	assert.Equal(t, []string{"/etc/grafana/bootstrap", "/usr/share/grafana/conf/orgs"},
		Layout{Path: "/etc/grafana/bootstrap/", OrgsRoot: "conf/orgs", HomePath: "/usr/share/grafana/"}.PermittedPaths())
}
