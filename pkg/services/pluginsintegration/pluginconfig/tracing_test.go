package pluginconfig

import (
	"testing"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewTracingCfg(t *testing.T) {
	t.Run("empty", func(t *testing.T) {
		cfg := setting.NewCfg()

		tracingCfg, err := newTracingCfg(setting.ProvideService(cfg))
		require.NoError(t, err)
		assert.False(t, tracingCfg.IsEnabled(), "tracing should be disabled")
		assert.Empty(t, tracingCfg.OpenTelemetry.Address)
		assert.Empty(t, tracingCfg.OpenTelemetry.Propagation)
	})

	t.Run("enabled", func(t *testing.T) {
		for _, tc := range []struct {
			name        string
			propagation string
		}{
			{"empty", ""},
			{"jaeger", "jaeger"},
			{"w3c", "w3c"},
			{"multiple", "jaeger,w3c"},
		} {
			t.Run(tc.name, func(t *testing.T) {
				const address = "127.0.0.1:4317"

				cfg := setting.NewCfg()
				otlpSect := cfg.Raw.Section("tracing.opentelemetry.otlp")
				otlpSect.Key("address").SetValue(address)
				if tc.propagation != "" {
					otlpSect.Key("propagation").SetValue(tc.propagation)
				}

				tracingCfg, err := newTracingCfg(setting.ProvideService(cfg))
				require.NoError(t, err)
				assert.True(t, tracingCfg.IsEnabled(), "tracing should be enabled")
				assert.Equal(t, address, tracingCfg.OpenTelemetry.Address)
				assert.Equal(t, tc.propagation, tracingCfg.OpenTelemetry.Propagation)
			})
		}
	})
}
