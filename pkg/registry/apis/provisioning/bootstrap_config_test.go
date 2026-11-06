package provisioning

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/bootstrap"
	"github.com/grafana/grafana/pkg/setting"
)

func TestBootstrapConfigFromSettings(t *testing.T) {
	tests := []struct {
		name            string
		path            string
		repositoryTypes []string
		allowedTargets  []string
		want            bootstrap.Config
		wantErr         bool
	}{
		{
			name: "disabled when no path is configured",
			want: bootstrap.Config{},
		},
		{
			name: "targets the default org namespace",
			path: "conf/provisioning/bootstrap",
			want: bootstrap.Config{Path: "conf/provisioning/bootstrap", Namespace: "default"},
		},
		{
			name:            "accepts an explicit type list that enables local repositories",
			path:            "conf/provisioning/bootstrap",
			repositoryTypes: []string{"github", "local"},
			want:            bootstrap.Config{Path: "conf/provisioning/bootstrap", Namespace: "default"},
		},
		{
			name:            "rejects a bootstrap path when local repositories are disabled",
			path:            "conf/provisioning/bootstrap",
			repositoryTypes: []string{"github"},
			wantErr:         true,
		},
		{
			// Admission would reject the repository, leaving the instance unprovisioned with
			// nothing in the configuration to say why.
			name:           "rejects a bootstrap path when its sync target is not allowed",
			path:           "conf/provisioning/bootstrap",
			allowedTargets: []string{"folder"},
			wantErr:        true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			allowedTargets := tt.allowedTargets
			if allowedTargets == nil {
				allowedTargets = []string{"folder", "folderless"}
			}
			got, err := bootstrapConfigFromSettings(&setting.Cfg{
				ProvisioningBootstrapPath:   tt.path,
				ProvisioningRepositoryTypes: tt.repositoryTypes,
				ProvisioningAllowedTargets:  allowedTargets,
			})
			if tt.wantErr {
				assert.Error(t, err)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestAllowedSyncTargets(t *testing.T) {
	configured := []string{"folder", "instance", "folderless"}

	assert.Equal(t, []provisioning.SyncTargetType{"folder", "instance", "folderless"},
		allowedSyncTargets(configured, false))
	assert.Equal(t, []provisioning.SyncTargetType{"folder", "folderless"},
		allowedSyncTargets(configured, true))
}
