package setting

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestNavigationSettings(t *testing.T) {

	t.Run("Should include defaults", func(t *testing.T) {
		cfg := NewCfg()
		_, _ = cfg.Raw.NewSection("navigation.apps")
		cfg.readNavigationSettings()

		require.Equal(t, "monitoring", cfg.NavigationAppConfig["grafana-k8s-app"].SectionID)
	})

	t.Run("Can add additional overrides via ini system", func(t *testing.T) {
		cfg := NewCfg()
		sec, _ := cfg.Raw.NewSection("navigation.apps")
		_, _ = sec.NewKey("nav_id_grafana-k8s-app", "dashboards")
		_, _ = sec.NewKey("nav_id_other-app", "admin 12")

		cfg.readNavigationSettings()

		require.Equal(t, "dashboards", cfg.NavigationAppConfig["grafana-k8s-app"].SectionID)
		require.Equal(t, "admin", cfg.NavigationAppConfig["other-app"].SectionID)

		require.Equal(t, int64(0), cfg.NavigationAppConfig["grafana-k8s-app"].SortWeight)
		require.Equal(t, int64(12), cfg.NavigationAppConfig["other-app"].SortWeight)
	})
}
