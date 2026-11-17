package extras

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository/local"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/setting"
)

func TestProvideConnectionFactoryFromConfig(t *testing.T) {
	configuredType := provisioning.ConnectionType("configured")
	tests := []struct {
		name     string
		types    []string
		expected []provisioning.ConnectionType
	}{
		{
			name:     "defaults to GitHub",
			expected: []provisioning.ConnectionType{provisioning.GithubConnectionType},
		},
		{
			name:     "uses configured connection types",
			types:    []string{string(configuredType)},
			expected: []provisioning.ConnectionType{configuredType},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			extras := make([]connection.Extra, 0, 2)
			for _, connectionType := range []provisioning.ConnectionType{
				provisioning.GithubConnectionType,
				configuredType,
			} {
				extra := connection.NewMockExtra(t)
				extra.On("Type").Return(connectionType)
				extras = append(extras, extra)
			}

			factory, err := ProvideConnectionFactoryFromConfig(&setting.Cfg{ProvisioningConnectionTypes: tt.types}, tracing.NewNoopTracerService(), extras)
			require.NoError(t, err)
			require.ElementsMatch(t, tt.expected, factory.Types())
		})
	}
}

func TestPermittedLocalPaths(t *testing.T) {
	configured := []string{"/etc/grafana/repositories"}

	tests := []struct {
		name      string
		bootstrap string
		want      []string
	}{
		{
			name: "no bootstrap path leaves the configured prefixes alone",
			want: configured,
		},
		{
			name:      "an absolute path is permitted as given",
			bootstrap: "/etc/grafana/bootstrap",
			want:      append(configured, "/etc/grafana/bootstrap"),
		},
		{
			name:      "a trailing slash is cleaned off",
			bootstrap: "/etc/grafana/bootstrap/",
			want:      append(configured, "/etc/grafana/bootstrap"),
		},
		{
			name:      "a relative path resolves against the home path",
			bootstrap: "conf/provisioning/bootstrap",
			want:      append(configured, "/usr/share/grafana/conf/provisioning/bootstrap"),
		},
		{
			// The empty prefix a cleaned root produces is a prefix of every path.
			name:      "the filesystem root is not permitted",
			bootstrap: "/",
			want:      configured,
		},
		{
			name:      "a traversal is not permitted",
			bootstrap: "../../../etc",
			want:      configured,
		},
		{
			name:      "a hidden directory is not permitted",
			bootstrap: "/etc/.grafana/bootstrap",
			want:      configured,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := PermittedLocalPaths(&setting.Cfg{
				HomePath:                   "/usr/share/grafana",
				PermittedProvisioningPaths: configured,
				ProvisioningBootstrapPath:  tt.bootstrap,
			})
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestPermittedLocalPathsMatchesTheResolver(t *testing.T) {
	for _, bootstrap := range []string{
		"/etc/grafana/bootstrap",
		"/etc/grafana/bootstrap/",
		"conf/provisioning/bootstrap",
		"conf/provisioning/bootstrap/",
	} {
		t.Run(bootstrap, func(t *testing.T) {
			cfg := &setting.Cfg{
				HomePath:                  "/usr/share/grafana",
				ProvisioningBootstrapPath: bootstrap,
			}

			permitted := PermittedLocalPaths(cfg)
			resolver := local.LocalFolderResolver{
				PermittedPrefixes: permitted,
				HomePath:          safepath.Clean(cfg.HomePath),
			}

			resolved, err := resolver.LocalPath(cfg.ProvisioningBootstrapPath)
			require.NoError(t, err, "the bootstrap repository's own path must resolve")
			assert.Equal(t, permitted, []string{resolved}, "the permitted prefix must be the resolved path")
		})
	}
}
