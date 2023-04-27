package keyretriever

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/manager/signature/statickey"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/stretchr/testify/require"
)

func Test_GetPublicKey(t *testing.T) {
	t.Run("it should return a static key", func(t *testing.T) {
		cfg := &config.Cfg{
			Features: featuremgmt.WithFeatures(),
		}
		kr := ProvideService(cfg, nil)
		key, err := kr.GetPublicKey(context.Background(), statickey.GetDefaultKeyID())
		require.NoError(t, err)
		require.Equal(t, statickey.GetDefaultKey(), key)
	})
}
