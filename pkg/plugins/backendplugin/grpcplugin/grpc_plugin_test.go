package grpcplugin

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"

	"github.com/hashicorp/go-hclog"
	goplugin "github.com/hashicorp/go-plugin"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-plugin-sdk-go/backend/grpcplugin"
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
		clientFactory: func() (*goplugin.Client, error) {
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
			return client, nil
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
		clientFactory: func() (*goplugin.Client, error) {
			return goplugin.NewClient(&goplugin.ClientConfig{
				HandshakeConfig:  handshake,
				VersionedPlugins: pluginSet,
				Cmd:              exec.Command(filepath.Join(t.TempDir(), "missing-plugin")), //nolint:gosec // G204: a path that does not exist
				AllowedProtocols: []goplugin.Protocol{goplugin.ProtocolGRPC},
				Logger:           hclog.NewNullLogger(),
			}), nil
		},
	}

	require.Error(t, p.Start(context.Background()))
	// go-plugin's client never reports exited when the process fails to
	// launch, so the plugin must drop it to be restarted.
	require.True(t, p.Exited())
	require.Nil(t, p.client)
}
