package extras

import (
	"testing"

	"github.com/stretchr/testify/require"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
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

			factory, err := ProvideConnectionFactoryFromConfig(&setting.Cfg{ProvisioningConnectionTypes: tt.types}, extras)
			require.NoError(t, err)
			require.ElementsMatch(t, tt.expected, factory.Types())
		})
	}
}
