package metadata

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/stretchr/testify/require"
)

func Test_KeeperMetadataStorage_GetKeeperConfig(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	s := setupTestService(t).(*secureValueMetadataStorage)

	features := featuremgmt.WithFeatures(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs, featuremgmt.FlagSecretsManagementAppPlatform)
	storage, err := ProvideKeeperMetadataStorage(s.db, features, s.accessClient)
	require.NoError(t, err)

	t.Run("get default sql keeper config", func(t *testing.T) {
		keeperType, keeperConfig, err := storage.GetKeeperConfig(ctx, "default", nil)
		require.NoError(t, err)
		require.Equal(t, contracts.SQLKeeperType, keeperType)
		require.Nil(t, keeperConfig)
	})

	t.Run("get test keeper config", func(t *testing.T) {
		keeperTest := "kp-test"
		keeperType, keeperConfig, err := storage.GetKeeperConfig(ctx, "default", &keeperTest)
		require.NoError(t, err)
		require.Equal(t, contracts.SQLKeeperType, keeperType)
		require.NotNil(t, keeperConfig)
	})
}
