package grpcplugin

import (
	"context"
	"errors"
	"testing"

	"github.com/hashicorp/go-plugin"
	"github.com/stretchr/testify/require"

	localv3 "github.com/grafana/grafana/pkg/plugins/backendplugin/v3"
)

func TestGrpcPluginAccessPolicyTokenLifetime(t *testing.T) {
	errNoProcess := errors.New("no process in this test")
	var issued []string
	p := &grpcPlugin{
		descriptor: PluginDescriptor{pluginID: "lifetime-test-app"},
		// Stands in for starting a process with the environment Grafana builds.
		clientFactory: func() (*plugin.Client, string, error) {
			token, err := localv3.IssueLocalAccessPolicyToken("lifetime-test-app")
			require.NoError(t, err)
			issued = append(issued, token)
			return nil, token, errNoProcess
		},
	}
	valid := func(token string) bool {
		_, ok := localv3.LocalAccessPolicyPluginID(token)
		return ok
	}

	require.ErrorIs(t, p.Start(context.Background()), errNoProcess)
	require.True(t, valid(issued[0]))

	require.ErrorIs(t, p.Start(context.Background()), errNoProcess)
	require.False(t, valid(issued[0]), "a restart revokes the replaced process's token")
	require.True(t, valid(issued[1]))

	other, err := localv3.IssueLocalAccessPolicyToken("lifetime-test-app")
	require.NoError(t, err)
	require.NoError(t, p.Stop(context.Background()))
	require.False(t, valid(issued[1]), "a stopped process's token must not work")
	require.True(t, valid(other), "only this plugin instance's process token is revoked")
}
