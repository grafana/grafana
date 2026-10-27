package publicdashboards

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/setting"
)

func TestEnabled(t *testing.T) {
	t.Run("returns false when ini setting is off", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.PublicDashboardsEnabled = false
		assert.False(t, Enabled(context.Background(), cfg))
	})

	t.Run("returns true when ini setting is on and flag is unset", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.PublicDashboardsEnabled = true
		assert.True(t, Enabled(context.Background(), cfg))
	})
}
