package grpcplugin

import (
	"context"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"

	"github.com/hashicorp/go-hclog"
	goplugin "github.com/hashicorp/go-plugin"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"

	"github.com/grafana/grafana-plugin-sdk-go/backend/grpcplugin"

	localv3 "github.com/grafana/grafana/pkg/plugins/backendplugin/v3"
	"github.com/grafana/grafana/pkg/plugins/log"
)

const helperPluginEnv = "GF_GRPCPLUGIN_TEST_HELPER_PLUGIN"

// TestHelperPluginV1 is not a test: TestGrpcPluginFailedStartKillsProcess runs
// the test binary as a plugin that only speaks plugin protocol version 1.
func TestHelperPluginV1(t *testing.T) {
	if os.Getenv(helperPluginEnv) != "1" {
		t.Skip("runs only as a helper plugin process")
	}
	goplugin.Serve(&goplugin.ServeConfig{
		HandshakeConfig:  handshake,
		VersionedPlugins: map[int]goplugin.PluginSet{1: {"diagnostics": &grpcplugin.DiagnosticsGRPCPlugin{}}},
		GRPCServer:       goplugin.DefaultGRPCServer,
	})
}

func TestGrpcPluginFailedStartKillsProcess(t *testing.T) {
	cmd := exec.Command(os.Args[0], "-test.run=^TestHelperPluginV1$") //nolint:gosec // G204: the test binary runs itself as the helper plugin
	cmd.Env = append(os.Environ(), helperPluginEnv+"=1")
	var client *goplugin.Client
	p := &grpcPlugin{
		clientFactory: func() (*goplugin.Client, string, error) {
			// Accept version 1 so the handshake succeeds and Grafana's own
			// protocol check is what fails the start.
			versions := map[int]goplugin.PluginSet{1: pluginSet[grpcplugin.ProtocolVersion]}
			for v, set := range pluginSet {
				versions[v] = set
			}
			client = goplugin.NewClient(&goplugin.ClientConfig{
				HandshakeConfig:  handshake,
				VersionedPlugins: versions,
				Cmd:              cmd,
				AllowedProtocols: []goplugin.Protocol{goplugin.ProtocolGRPC},
				Logger:           hclog.NewNullLogger(),
			})
			return client, "", nil
		},
	}

	t.Cleanup(func() {
		if client != nil {
			client.Kill() // don't leave the helper running if the test fails
		}
	})

	require.ErrorContains(t, p.Start(context.Background()), "plugin protocol version not supported")
	require.Eventually(t, client.Exited, 5*time.Second, 10*time.Millisecond,
		"a failed start must not leave the process running")
	require.True(t, p.Exited(), "a failed start must count as exited, or it is never restarted")
	require.Nil(t, p.client)
	require.Nil(t, p.pluginClient)
	require.Nil(t, p.clientV3)
}

func TestGrpcPluginFailedLaunchIsExited(t *testing.T) {
	p := &grpcPlugin{
		clientFactory: func() (*goplugin.Client, string, error) {
			return goplugin.NewClient(&goplugin.ClientConfig{
				HandshakeConfig:  handshake,
				VersionedPlugins: pluginSet,
				Cmd:              exec.Command(filepath.Join(t.TempDir(), "missing-plugin")), //nolint:gosec // G204: a path that does not exist
				AllowedProtocols: []goplugin.Protocol{goplugin.ProtocolGRPC},
				Logger:           hclog.NewNullLogger(),
			}), "", nil
		},
	}

	require.Error(t, p.Start(context.Background()))
	// go-plugin's client never reports exited when the process fails to
	// launch, so the plugin must drop it to be restarted.
	require.True(t, p.Exited())
	require.Nil(t, p.client)
}

func TestGrpcPluginAccessPolicyTokenLifetime(t *testing.T) {
	errNoProcess := errors.New("no process in this test")
	var issued []string
	p := &grpcPlugin{
		descriptor: PluginDescriptor{pluginID: "lifetime-test-app"},
		// Stands in for starting a process with the environment Grafana builds.
		clientFactory: func() (*goplugin.Client, string, error) {
			token, err := localv3.IssueLocalAccessPolicyToken("lifetime-test-app", nil)
			require.NoError(t, err)
			issued = append(issued, token)
			return nil, token, errNoProcess
		},
	}
	valid := func(token string) bool {
		_, _, ok := localv3.LookupLocalAccessPolicyToken(token)
		return ok
	}

	require.ErrorIs(t, p.Start(context.Background()), errNoProcess)
	require.False(t, valid(issued[0]), "a failed start revokes its token immediately")

	require.ErrorIs(t, p.Start(context.Background()), errNoProcess)
	require.False(t, valid(issued[0]), "a restart revokes the replaced process's token")
	require.False(t, valid(issued[1]), "a failed restart revokes its token immediately")

	other, err := localv3.IssueLocalAccessPolicyToken("lifetime-test-app", nil)
	require.NoError(t, err)
	t.Cleanup(func() { localv3.RevokeLocalAccessPolicyToken(other) })
	p.accessPolicyToken, err = localv3.IssueLocalAccessPolicyToken("lifetime-test-app", nil)
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
		token, err = localv3.IssueLocalAccessPolicyToken("missing-app", nil)
		require.NoError(t, err)
		t.Cleanup(func() { localv3.RevokeLocalAccessPolicyToken(token) })
		return []string{localv3.EnvVarAccessPolicyToken + "=" + token}
	})
	require.NoError(t, err)
	require.Error(t, p.Start(context.Background()))
	require.NotEmpty(t, token)
	_, _, valid := localv3.LookupLocalAccessPolicyToken(token)
	require.False(t, valid)
	require.Empty(t, p.accessPolicyToken)
	require.Equal(t, pluginStateStartFail, p.state)
}
