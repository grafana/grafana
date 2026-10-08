package grpcplugin

import (
	"testing"

	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"

	"github.com/grafana/grafana/pkg/plugins/log"
)

func TestNewClientConfig_processEnv(t *testing.T) {
	t.Setenv("GOMEMLIMIT", "8GiB")
	t.Setenv("HOST_ONLY_VAR", "host")
	env := []string{"GF_VERSION=1", "GOMEMLIMIT=1GiB"}

	for _, tc := range []struct {
		name            string
		skipHostEnvVars bool
		wantHostOnlyVar bool
	}{
		{name: "plugin that inherits the host environment", skipHostEnvVars: false, wantHostOnlyVar: true},
		{name: "plugin that skips the host environment", skipHostEnvVars: true, wantHostOnlyVar: false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			descriptor := PluginDescriptor{pluginID: "test", executablePath: "test", skipHostEnvVars: tc.skipHostEnvVars}
			cfg, err := newClientConfig(descriptor, env, log.NewTestLogger(), noop.NewTracerProvider().Tracer(""))
			require.NoError(t, err)

			require.True(t, cfg.SkipHostEnv, "go-plugin must not append the host environment after Grafana's variables")
			// Cmd.Environ resolves duplicate keys the same way the started process sees them.
			got := cfg.Cmd.Environ()
			require.Contains(t, got, "GF_VERSION=1")
			require.Contains(t, got, "GOMEMLIMIT=1GiB")
			require.NotContains(t, got, "GOMEMLIMIT=8GiB")
			if tc.wantHostOnlyVar {
				require.Contains(t, got, "HOST_ONLY_VAR=host")
			} else {
				require.NotContains(t, got, "HOST_ONLY_VAR=host")
			}
		})
	}
}
