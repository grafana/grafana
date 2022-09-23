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

	require.Equal(t, "alerting", cfg.NavigationAppConfig["grafana-k8s-app"])
}

func TestNavigationSettings(t *testing.T) {
	cfg := NewCfg()
	sec, _ := cfg.Raw.NewSection("navigation.apps")
	_, _ = sec.NewKey("nav_id_grafana-k8s-app", "dashboards")
	_, _ = sec.NewKey("nav_id_other-app", "admin")

	err := cfg.readNavigationSettings()
	require.NoError(t, err)

	require.Equal(t, "dashboards", cfg.NavigationAppConfig["grafana-k8s-app"])
	require.Equal(t, "admin", cfg.NavigationAppConfig["other-app"])
}
