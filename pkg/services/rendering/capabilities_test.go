package rendering

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
)

type dummyPluginManager struct{}

func (d *dummyPluginManager) Renderer() *plugins.Plugin {
	return nil
}

var dummyRendererUrl = "http://dummyurl.com"
var testCapabilitySemverConstraint = "> 1.0.0"

func TestCapabilities(t *testing.T) {
	cfg := setting.NewCfg()
	rs := &RenderingService{
		Cfg:                   cfg,
		RendererPluginManager: &dummyPluginManager{},
		log:                   log.New("test-capabilities-rendering-service"),
	}

	t.Run("When node renderer is not available", func(t *testing.T) {
		rs.Cfg.RendererUrl = ""
		res, err := rs.HasCapability(TestCapability)

		require.ErrorIs(t, err, ErrRenderUnavailable)
		require.Equal(t, CapabilitySupportRequestResult{
			IsSupported:      false,
			SemverConstraint: testCapabilitySemverConstraint,
		}, res)
	})

	t.Run("When renderer version is not yet populated", func(t *testing.T) {
		rs.Cfg.RendererUrl = dummyRendererUrl
		rs.version = ""
		res, err := rs.HasCapability(TestCapability)

		require.ErrorIs(t, err, ErrInvalidPluginVersion)
		require.Equal(t, CapabilitySupportRequestResult{
			IsSupported:      false,
			SemverConstraint: testCapabilitySemverConstraint,
		}, res)
	})

	t.Run("When renderer version is not a valid semver", func(t *testing.T) {
		rs.Cfg.RendererUrl = dummyRendererUrl
		rs.version = "xabc123"
		res, err := rs.HasCapability(TestCapability)

		require.ErrorIs(t, err, ErrInvalidPluginVersion)
		require.Equal(t, CapabilitySupportRequestResult{
			IsSupported:      false,
			SemverConstraint: testCapabilitySemverConstraint,
		}, res)
	})

	t.Run("When renderer version does not match target constraint", func(t *testing.T) {
		rs.Cfg.RendererUrl = dummyRendererUrl
		rs.version = "1.0.0"
		res, err := rs.HasCapability(TestCapability)

		require.NoError(t, err)
		require.Equal(t, CapabilitySupportRequestResult{
			IsSupported:      false,
			SemverConstraint: testCapabilitySemverConstraint,
		}, res)
	})

	t.Run("When renderer version does not match target constraint", func(t *testing.T) {
		rs.Cfg.RendererUrl = dummyRendererUrl
		rs.version = "2.0.0"
		res, err := rs.HasCapability(TestCapability)

		require.NoError(t, err)
		require.Equal(t, CapabilitySupportRequestResult{
			IsSupported:      true,
			SemverConstraint: testCapabilitySemverConstraint,
		}, res)
	})

	t.Run("When capability is unknown", func(t *testing.T) {
		rs.Cfg.RendererUrl = dummyRendererUrl
		rs.version = "2.0.0"
		res, err := rs.HasCapability("unknown")

		require.ErrorIs(t, err, ErrUnknownCapability)
		require.Equal(t, CapabilitySupportRequestResult{
			IsSupported:      false,
			SemverConstraint: "",
		}, res)
	})

	t.Run("When capability has invalid semver constraint", func(t *testing.T) {
		rs.Cfg.RendererUrl = dummyRendererUrl
		rs.version = "2.0.0"
		_, err := rs.HasCapability(TestCapabilityInvalidSemver)

		require.ErrorIs(t, err, ErrUnknownCapability)
	})
}
