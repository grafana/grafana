package ngalert

import (
	"testing"

	"github.com/stretchr/testify/require"
	ptr "github.com/xorcare/pointer"

	"github.com/grafana/grafana/pkg/setting"
)

func TestProvideService(t *testing.T) {
	t.Run("should return nil if UnifiedAlerting is disabled", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.UnifiedAlerting.Enabled = ptr.Bool(false)
		s, err := ProvideService(cfg, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil)
		require.NoError(t, err)
		require.Nil(t, s)
	})
}
