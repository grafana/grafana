package provisioning

import (
	"testing"

	"github.com/stretchr/testify/require"

	apisprovisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	"github.com/grafana/grafana/pkg/setting"
)

func TestConnectionFactoryUsesConfiguredTypes(t *testing.T) {
	configuredType := apisprovisioning.ConnectionType("configured")
	extras := make([]connection.Extra, 0, 2)
	for _, connectionType := range []apisprovisioning.ConnectionType{
		apisprovisioning.GithubConnectionType,
		configuredType,
	} {
		extra := connection.NewMockExtra(t)
		extra.On("Type").Return(connectionType)
		extras = append(extras, extra)
	}

	cfg := ControllerConfig{
		Settings:         &setting.Cfg{ProvisioningConnectionTypes: []string{string(configuredType)}},
		connectionExtras: extras,
	}
	factory, err := cfg.ConnectionFactory()
	require.NoError(t, err)
	require.ElementsMatch(t, []apisprovisioning.ConnectionType{configuredType}, factory.Types())
}

func TestDefaultConnectionTypes(t *testing.T) {
	registeredTypes := []apisprovisioning.ConnectionType{
		apisprovisioning.GithubConnectionType,
		apisprovisioning.GithubEnterpriseConnectionType,
		apisprovisioning.GithubOAuthConnectionType,
		apisprovisioning.GithubEnterpriseOAuthConnectionType,
		apisprovisioning.BitbucketOAuthConnectionType,
		apisprovisioning.GitlabOAuthConnectionType,
	}
	extras := make([]connection.Extra, 0, len(registeredTypes))
	for _, connectionType := range registeredTypes {
		extra := connection.NewMockExtra(t)
		extra.On("Type").Return(connectionType)
		extras = append(extras, extra)
	}

	require.ElementsMatch(t, []string{"github", "githubEnterprise"}, defaultConnectionTypes(extras))
}
