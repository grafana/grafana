package angularpatternsstore

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/kvstore"
)

func TestAngularPatternsStore(t *testing.T) {
	mockPatterns := []map[string]interface{}{
		{"name": "PanelCtrl", "type": "contains", "pattern": "PanelCtrl"},
		{"name": "ConfigCtrl", "type": "contains", "pattern": "ConfigCtrl"},
	}

	t.Run("get set", func(t *testing.T) {
		svc := ProvideService(kvstore.NewFakeKVStore())

		t.Run("get empty", func(t *testing.T) {
			_, ok, err := svc.Get(context.Background())
			require.NoError(t, err)
			require.False(t, ok)
		})

		t.Run("set and get", func(t *testing.T) {
			err := svc.Set(context.Background(), mockPatterns)
			require.NoError(t, err)

			expV, err := json.Marshal(mockPatterns)
			require.NoError(t, err)

			dbV, ok, err := svc.Get(context.Background())
			require.NoError(t, err)
			require.True(t, ok)
			require.Equal(t, string(expV), dbV)
		})
	})

	t.Run("latest update", func(t *testing.T) {
		underlyingKv := kvstore.NewFakeKVStore()
		svc := ProvideService(underlyingKv)

		t.Run("empty", func(t *testing.T) {
			lastUpdated, err := svc.GetLastUpdated(context.Background())
			require.NoError(t, err)
			require.Zero(t, lastUpdated)
		})

		t.Run("not empty", func(t *testing.T) {
			err := svc.Set(context.Background(), mockPatterns)
			require.NoError(t, err)

			lastUpdated, err := svc.GetLastUpdated(context.Background())
			require.NoError(t, err)
			require.WithinDuration(t, time.Now(), lastUpdated, time.Second*10)
		})

		t.Run("invalid timestamp stored", func(t *testing.T) {
			err := underlyingKv.Set(context.Background(), 0, kvNamespace, "last_updated", "abcd")
			require.NoError(t, err)

			lastUpdated, err := svc.GetLastUpdated(context.Background())
			require.NoError(t, err)
			require.Zero(t, lastUpdated)
		})
	})
}
