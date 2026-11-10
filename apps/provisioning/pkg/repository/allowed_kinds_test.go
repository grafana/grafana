package repository

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

func sourceRepo(allow ...provisioning.SourceAllowedKind) *provisioning.Repository {
	return &provisioning.Repository{Spec: provisioning.RepositorySpec{
		Type:   provisioning.SourceRepositoryType,
		Source: &provisioning.SourceRepositoryConfig{Allow: allow},
	}}
}

func TestCheckAllowedKind(t *testing.T) {
	kind := func(group, kind string) provisioning.SourceAllowedKind {
		return provisioning.SourceAllowedKind{Group: group, Kind: kind}
	}

	tests := []struct {
		name    string
		repo    *provisioning.Repository
		group   string
		kind    string
		allowed bool
	}{
		{"default allows dashboards", sourceRepo(), "dashboard.grafana.app", "Dashboard", true},
		{"default refuses anything else", sourceRepo(), "playlist.grafana.app", "Playlist", false},
		{"folders are always allowed", sourceRepo(kind("plugins.grafana.app", "Plugin")), "folder.grafana.app", "Folder", true},
		{"an explicit list replaces the default", sourceRepo(kind("plugins.grafana.app", "Plugin")), "dashboard.grafana.app", "Dashboard", false},
		{"exact match", sourceRepo(kind("plugins.grafana.app", "Plugin")), "plugins.grafana.app", "Plugin", true},
		{"kind must match", sourceRepo(kind("plugins.grafana.app", "Plugin")), "plugins.grafana.app", "Other", false},
		{"any kind of a group", sourceRepo(kind("plugins.grafana.app", "*")), "plugins.grafana.app", "Other", true},
		{"subdomain wildcard", sourceRepo(kind("*.datasource.grafana.app", "DataSource")), "prometheus.datasource.grafana.app", "DataSource", true},
		{"wildcard needs a subdomain", sourceRepo(kind("*.datasource.grafana.app", "DataSource")), "datasource.grafana.app", "DataSource", false},
		{"wildcard does not match a lookalike", sourceRepo(kind("*.datasource.grafana.app", "DataSource")), "evil-datasource.grafana.app", "DataSource", false},
		{"other repository types are not restricted", &provisioning.Repository{Spec: provisioning.RepositorySpec{Type: provisioning.GitRepositoryType}}, "playlist.grafana.app", "Playlist", true},
		{"no config is not restricted", nil, "playlist.grafana.app", "Playlist", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := CheckAllowedKind(tt.repo, tt.group, tt.kind)
			if tt.allowed {
				require.NoError(t, err)
				return
			}
			assert.ErrorContains(t, err, "not allowed")
		})
	}
}

func TestSourceClaimsOverlap(t *testing.T) {
	kind := func(group, kind string) provisioning.SourceAllowedKind {
		return provisioning.SourceAllowedKind{Group: group, Kind: kind}
	}

	tests := []struct {
		name     string
		a, b     *provisioning.Repository
		overlaps bool
	}{
		{"two defaults claim dashboards", sourceRepo(), sourceRepo(), true},
		{"disjoint kinds", sourceRepo(kind("plugins.grafana.app", "Plugin")), sourceRepo(kind("setting.grafana.app", "Settings")), false},
		{"same kind", sourceRepo(kind("plugins.grafana.app", "Plugin")), sourceRepo(kind("plugins.grafana.app", "Plugin")), true},
		{"a wildcard kind covers a specific one", sourceRepo(kind("plugins.grafana.app", "*")), sourceRepo(kind("plugins.grafana.app", "Plugin")), true},
		{"a wildcard group covers a specific one", sourceRepo(kind("*.datasource.grafana.app", "DataSource")), sourceRepo(kind("prometheus.datasource.grafana.app", "DataSource")), true},
		{"different kinds of one group", sourceRepo(kind("plugins.grafana.app", "Plugin")), sourceRepo(kind("plugins.grafana.app", "PluginSettings")), false},
		{"dashboards against plugins", sourceRepo(), sourceRepo(kind("plugins.grafana.app", "Plugin")), false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, got := sourceClaimsOverlap(tt.a, tt.b)
			assert.Equal(t, tt.overlaps, got)
			_, reverse := sourceClaimsOverlap(tt.b, tt.a)
			assert.Equal(t, tt.overlaps, reverse, "overlap is symmetric")
		})
	}
}
