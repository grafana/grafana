package publicdashboards

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

func TestEnabled(t *testing.T) {
	t.Run("returns false when ini setting is off", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.PublicDashboardsEnabled = false
		assert.False(t, Enabled(context.Background(), cfg))
	})

	t.Run("returns false when ini setting is off and flag is on", func(t *testing.T) {
		featuremgmt.WithEnabledFlags(t, featuremgmt.FlagDashboardsDisablePublicDashboards)
		cfg := setting.NewCfg()
		cfg.PublicDashboardsEnabled = false
		assert.False(t, Enabled(context.Background(), cfg))
	})

	t.Run("returns true when ini setting is on and flag is off", func(t *testing.T) {
		featuremgmt.WithDisabledFlags(t, featuremgmt.FlagDashboardsDisablePublicDashboards)
		cfg := setting.NewCfg()
		cfg.PublicDashboardsEnabled = true
		assert.True(t, Enabled(context.Background(), cfg))
	})

	t.Run("returns false when ini setting is on and flag is on", func(t *testing.T) {
		featuremgmt.WithEnabledFlags(t, featuremgmt.FlagDashboardsDisablePublicDashboards)
		cfg := setting.NewCfg()
		cfg.PublicDashboardsEnabled = true
		assert.False(t, Enabled(context.Background(), cfg))
	})

	t.Run("returns true when flag is unset (no provider)", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.PublicDashboardsEnabled = true
		assert.True(t, Enabled(context.Background(), cfg))
	})
}
