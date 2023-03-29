package config

import (
	"testing"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewOpentelemetryCfg(t *testing.T) {
	t.Run("empty", func(t *testing.T) {
		cfg := setting.NewCfg()

		otelCfg, err := NewOpentelemetryCfg(cfg)
		require.NoError(t, err)
		assert.False(t, otelCfg.IsEnabled(), "otel should be disabled")
		assert.Empty(t, otelCfg.Address)
		assert.Empty(t, otelCfg.Propagation)
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
			t.Run(tc.propagation, func(t *testing.T) {
				const address = "127.0.0.1:4317"

				cfg := setting.NewCfg()
				otlpSect := cfg.Raw.Section("tracing.opentelemetry.otlp")
				otlpSect.Key("address").SetValue(address)
				if tc.propagation != "" {
					otlpSect.Key("propagation").SetValue(tc.propagation)
				}

				otelCfg, err := NewOpentelemetryCfg(cfg)
				require.NoError(t, err)
				assert.True(t, otelCfg.IsEnabled(), "otel should be enabled")
				assert.Equal(t, address, otelCfg.Address)
				assert.Equal(t, tc.propagation, otelCfg.Propagation)
			})
		}
	})
}
