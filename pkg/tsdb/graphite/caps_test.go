package graphite

import (
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/backend/tracing"
	"github.com/stretchr/testify/assert"
)

func TestCapsEffectiveValues(t *testing.T) {
	t.Run("zero field falls back to default", func(t *testing.T) {
		var c caps
		assert.Equal(t, defaultRenderResponseMaxBytes, c.renderResponse())
		assert.Equal(t, defaultResourceResponseMaxBytes, c.resourceResponse())
		assert.Equal(t, defaultResourceRequestMaxBytes, c.resourceRequest())
	})

	t.Run("positive field is used as-is", func(t *testing.T) {
		c := caps{renderResponseMaxBytes: 5, resourceResponseMaxBytes: 6, resourceRequestMaxBytes: 7}
		assert.Equal(t, int64(5), c.renderResponse())
		assert.Equal(t, int64(6), c.resourceResponse())
		assert.Equal(t, int64(7), c.resourceRequest())
	})
}

func TestProvideServiceLoadsCaps(t *testing.T) {
	s := ProvideService(httpclient.NewProvider(), tracing.DefaultTracer())

	assert.Equal(t, defaultRenderResponseMaxBytes, s.caps.renderResponseMaxBytes)
	assert.Equal(t, defaultResourceResponseMaxBytes, s.caps.resourceResponseMaxBytes)
	assert.Equal(t, defaultResourceRequestMaxBytes, s.caps.resourceRequestMaxBytes)
}

func TestLoadCaps(t *testing.T) {
	t.Run("defaults when env unset", func(t *testing.T) {
		c := loadCaps()
		assert.Equal(t, defaultRenderResponseMaxBytes, c.renderResponseMaxBytes)
		assert.Equal(t, defaultResourceResponseMaxBytes, c.resourceResponseMaxBytes)
		assert.Equal(t, defaultResourceRequestMaxBytes, c.resourceRequestMaxBytes)
	})

	t.Run("valid override is applied", func(t *testing.T) {
		t.Setenv("GF_PLUGIN_RENDER_RESPONSE_MAX_BYTES", "104857600") // 100 MiB
		assert.Equal(t, int64(104857600), loadCaps().renderResponseMaxBytes)
	})

	t.Run("value below the 1 KiB floor is clamped up", func(t *testing.T) {
		t.Setenv("GF_PLUGIN_RESOURCE_REQUEST_MAX_BYTES", "100")
		assert.Equal(t, capMinBytes, loadCaps().resourceRequestMaxBytes)
	})

	t.Run("value above the 1 GiB ceiling is clamped down", func(t *testing.T) {
		t.Setenv("GF_PLUGIN_RENDER_RESPONSE_MAX_BYTES", "9999999999") // ~9.3 GiB
		assert.Equal(t, capMaxBytes, loadCaps().renderResponseMaxBytes)
	})

	t.Run("junk, zero, or negative falls back to the default", func(t *testing.T) {
		for _, raw := range []string{"not-a-number", "0", "-5"} {
			t.Setenv("GF_PLUGIN_RESOURCE_RESPONSE_MAX_BYTES", raw)
			assert.Equal(t, defaultResourceResponseMaxBytes, loadCaps().resourceResponseMaxBytes,
				"input %q should fall back to default", raw)
		}
	})
}
