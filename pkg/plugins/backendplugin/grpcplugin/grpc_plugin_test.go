package grpcplugin

import (
	"context"
	"os"
	"os/exec"
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
	p := &grpcPlugin{
		clientFactory: func() (*goplugin.Client, error) {
			// Accept version 1 so the handshake succeeds and Grafana's own
			// protocol check is what fails the start.
			versions := map[int]goplugin.PluginSet{1: pluginSet[grpcplugin.ProtocolVersion]}
			for v, set := range pluginSet {
				versions[v] = set
			}
			return goplugin.NewClient(&goplugin.ClientConfig{
				HandshakeConfig:  handshake,
				VersionedPlugins: versions,
				Cmd:              cmd,
				AllowedProtocols: []goplugin.Protocol{goplugin.ProtocolGRPC},
				Logger:           hclog.NewNullLogger(),
			}), nil
		},
	}

	t.Cleanup(func() {
		if p.client != nil {
			p.client.Kill() // don't leave the helper running if the test fails
		}
	})

	require.ErrorContains(t, p.Start(context.Background()), "plugin protocol version not supported")
	require.Eventually(t, p.Exited, 5*time.Second, 10*time.Millisecond,
		"a failed start must not leave the process running, or it is never restarted")
	require.Nil(t, p.pluginClient)
	require.Nil(t, p.clientV3)
}
