package setting

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestNavigationSettingDefaults(t *testing.T) {
	cfg := NewCfg()
	_, _ = cfg.Raw.NewSection("navigation")
	err := cfg.readNavigationSettings()
	require.NoError(t, err)

	require.Equal(t, "alerting", cfg.PluginAppNavIds["grafana-k8s-app"])
}

func TestNavigationSettings(t *testing.T) {
	cfg := NewCfg()
	sec, _ := cfg.Raw.NewSection("navigation")
	_, _ = sec.NewKey("app_nav_id_grafana-k8s-app", "dashboards")
	_, _ = sec.NewKey("app_nav_id_other-app", "admin")

	err := cfg.readNavigationSettings()
	require.NoError(t, err)

	require.Equal(t, "dashboards", cfg.PluginAppNavIds["grafana-k8s-app"])
	require.Equal(t, "admin", cfg.PluginAppNavIds["other-app"])
}
