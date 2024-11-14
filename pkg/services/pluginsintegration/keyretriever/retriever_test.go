package keyretriever

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/plugins/manager/signature/statickey"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/keyretriever/dynamic"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/keystore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func Test_GetPublicKey(t *testing.T) {
	t.Run("it should return a static key", func(t *testing.T) {
		cfg := &setting.Cfg{}
		kr := ProvideService(dynamic.ProvideService(cfg, keystore.ProvideService(kvstore.NewFakeKVStore())))
		key, err := kr.GetPublicKey(context.Background(), statickey.GetDefaultKeyID())
		require.NoError(t, err)
		require.Equal(t, statickey.GetDefaultKey(), key)
	})
}
