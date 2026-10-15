package grpcplugin

import (
	"context"
	"errors"
	"path/filepath"
	"testing"

	"github.com/hashicorp/go-plugin"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"

	localv3 "github.com/grafana/grafana/pkg/plugins/backendplugin/v3"
	"github.com/grafana/grafana/pkg/plugins/log"
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
	require.False(t, valid(issued[0]), "a failed start revokes its token immediately")

	require.ErrorIs(t, p.Start(context.Background()), errNoProcess)
	require.False(t, valid(issued[0]), "a restart revokes the replaced process's token")
	require.False(t, valid(issued[1]), "a failed restart revokes its token immediately")

	other, err := localv3.IssueLocalAccessPolicyToken("lifetime-test-app")
	require.NoError(t, err)
	t.Cleanup(func() { localv3.RevokeLocalAccessPolicyToken(other) })
	p.accessPolicyToken, err = localv3.IssueLocalAccessPolicyToken("lifetime-test-app")
	require.NoError(t, err)
	current := p.accessPolicyToken
	require.NoError(t, p.Stop(context.Background()))
	require.False(t, valid(current), "a stopped process's token must not work")
	require.True(t, valid(other), "only this plugin instance's process token is revoked")
}

func TestGrpcPluginRevokesTokenWhenProcessCannotStart(t *testing.T) {
	var token string
	p, err := newGrpcPlugin(PluginDescriptor{
		pluginID: "missing-app", executablePath: filepath.Join(t.TempDir(), "missing-plugin"),
		versionedPlugins: pluginSet,
	}, log.NewTestLogger(), noop.NewTracerProvider().Tracer("test"), func() []string {
		var err error
		token, err = localv3.IssueLocalAccessPolicyToken("missing-app")
		require.NoError(t, err)
		t.Cleanup(func() { localv3.RevokeLocalAccessPolicyToken(token) })
		return []string{localv3.EnvVarAccessPolicyToken + "=" + token}
	})
	require.NoError(t, err)
	require.Error(t, p.Start(context.Background()))
	require.NotEmpty(t, token)
	_, valid := localv3.LocalAccessPolicyPluginID(token)
	require.False(t, valid)
	require.Empty(t, p.accessPolicyToken)
	require.Equal(t, pluginStateStartFail, p.state)
}
