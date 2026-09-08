package v2

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestParseConfiguration(t *testing.T) {
	t.Run("disabled configuration needs no renderer settings", func(t *testing.T) {
		cfg, err := ParseConfiguration(ConfigurationInput{})
		require.NoError(t, err)
		require.False(t, cfg.Available())
	})

	t.Run("enabled configuration parses URLs and derives the callback domain", func(t *testing.T) {
		cfg, err := ParseConfiguration(ConfigurationInput{
			RendererServerURL:   "https://renderer.example.com/render/",
			RendererCallbackURL: "https://grafana.example.com/grafana/",
			RendererAuthToken:   "renderer-token",
			RendererTenantID:    "tenant-42",
			RenderKeyLifetime:   5 * time.Minute,
			BuildVersion:        "13.2.0",
		})
		require.NoError(t, err)
		require.True(t, cfg.Available())

		enabled, err := cfg.enabled()
		require.NoError(t, err)
		require.Equal(t, "renderer.example.com", enabled.rendererURL.url.Hostname())
		require.Equal(t, "grafana.example.com", enabled.callbackURL.url.Hostname())
		require.Equal(t, "grafana.example.com", enabled.callbackDomain.value)
		require.Equal(t, "tenant-42", enabled.rendererTenantID.value)
	})

	t.Run("enabled configuration rejects an invalid renderer URL", func(t *testing.T) {
		_, err := ParseConfiguration(ConfigurationInput{
			RendererServerURL:   "://invalid",
			RendererCallbackURL: "https://grafana.example.com/",
			RendererAuthToken:   "renderer-token",
			RenderKeyLifetime:   time.Minute,
		})
		require.ErrorContains(t, err, "renderer server URL")
	})

	t.Run("enabled configuration rejects a missing callback URL", func(t *testing.T) {
		_, err := ParseConfiguration(ConfigurationInput{
			RendererServerURL: "https://renderer.example.com/render",
			RendererAuthToken: "renderer-token",
			RenderKeyLifetime: time.Minute,
		})
		require.ErrorContains(t, err, "callback URL")
	})
}
