package setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestReadZanzanaSettings_Rollout(t *testing.T) {
	t.Run("parses valid percentages", func(t *testing.T) {
		cfg, err := NewCfgFromBytes([]byte(`
[zanzana.rollout]
dashboard.grafana.app/dashboards = 0.5
folder.grafana.app/folders = 1.0
`))
		require.NoError(t, err)
		assert.Equal(t, map[string]float64{
			"dashboard.grafana.app/dashboards": 0.5,
			"folder.grafana.app/folders":       1.0,
		}, cfg.ZanzanaRollout.ResourcePercentages)
	})

	t.Run("zero and one boundaries are accepted", func(t *testing.T) {
		cfg, err := NewCfgFromBytes([]byte(`
[zanzana.rollout]
dashboard.grafana.app/dashboards = 0.0
folder.grafana.app/folders = 1.0
`))
		require.NoError(t, err)
		assert.Equal(t, map[string]float64{
			"dashboard.grafana.app/dashboards": 0.0,
			"folder.grafana.app/folders":       1.0,
		}, cfg.ZanzanaRollout.ResourcePercentages)
	})

	t.Run("skips entries with non-float values", func(t *testing.T) {
		cfg, err := NewCfgFromBytes([]byte(`
[zanzana.rollout]
dashboard.grafana.app/dashboards = not-a-number
folder.grafana.app/folders = 0.5
`))
		require.NoError(t, err)
		assert.Equal(t, map[string]float64{
			"folder.grafana.app/folders": 0.5,
		}, cfg.ZanzanaRollout.ResourcePercentages)
	})

	t.Run("skips entries with percentage below zero", func(t *testing.T) {
		cfg, err := NewCfgFromBytes([]byte(`
[zanzana.rollout]
dashboard.grafana.app/dashboards = -0.1
folder.grafana.app/folders = 0.5
`))
		require.NoError(t, err)
		assert.Equal(t, map[string]float64{
			"folder.grafana.app/folders": 0.5,
		}, cfg.ZanzanaRollout.ResourcePercentages)
	})

	t.Run("skips entries with percentage above one", func(t *testing.T) {
		cfg, err := NewCfgFromBytes([]byte(`
[zanzana.rollout]
dashboard.grafana.app/dashboards = 1.5
folder.grafana.app/folders = 0.5
`))
		require.NoError(t, err)
		assert.Equal(t, map[string]float64{
			"folder.grafana.app/folders": 0.5,
		}, cfg.ZanzanaRollout.ResourcePercentages)
	})

	t.Run("produces empty map when all entries are invalid", func(t *testing.T) {
		cfg, err := NewCfgFromBytes([]byte(`
[zanzana.rollout]
dashboard.grafana.app/dashboards = bad
folder.grafana.app/folders = 2.0
`))
		require.NoError(t, err)
		assert.Empty(t, cfg.ZanzanaRollout.ResourcePercentages)
	})

	t.Run("empty section produces empty map", func(t *testing.T) {
		cfg, err := NewCfgFromBytes([]byte(`
[zanzana.rollout]
`))
		require.NoError(t, err)
		assert.Empty(t, cfg.ZanzanaRollout.ResourcePercentages)
	})
}

func TestReadZanzanaSettings_OpenFGAExperimentals(t *testing.T) {
	t.Run("disabled by default", func(t *testing.T) {
		cfg, err := NewCfgFromBytes(nil)
		require.NoError(t, err)
		assert.Empty(t, cfg.ZanzanaServer.OpenFgaServerSettings.Experimentals)
	})

	t.Run("reads experimentals from config", func(t *testing.T) {
		cfg, err := NewCfgFromBytes([]byte(`
[openfga]
experimentals = enable-check-optimizations,weighted_graph_check
`))
		require.NoError(t, err)
		assert.Equal(t, []string{"enable-check-optimizations", "weighted_graph_check"}, cfg.ZanzanaServer.OpenFgaServerSettings.Experimentals)
	})

	t.Run("environment overrides config", func(t *testing.T) {
		t.Setenv("GF_OPENFGA_EXPERIMENTALS", "weighted_graph_check")
		cfg, err := NewCfgFromBytes([]byte(`
[openfga]
experimentals = enable-check-optimizations
`))
		require.NoError(t, err)
		assert.Equal(t, []string{"weighted_graph_check"}, cfg.ZanzanaServer.OpenFgaServerSettings.Experimentals)
	})
}
