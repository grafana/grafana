package secretkeeper

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption/cipher"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption/manager"
	"github.com/grafana/grafana/pkg/registry/apis/secret/secretkeeper/sqlkeeper"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	encryptionstorage "github.com/grafana/grafana/pkg/storage/secret/encryption"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func Test_OSSKeeperService_GetKeepers(t *testing.T) {
	cfg := &setting.Cfg{
		SecretsManagement: setting.SecretsManagerSettings{
			SecretKey:          "sdDkslslld",
			EncryptionProvider: "secretKey.v1",
			Encryption: setting.EncryptionSettings{
				DataKeysCacheTTL:        5 * time.Minute,
				DataKeysCleanupInterval: 1 * time.Nanosecond,
				Algorithm:               cipher.AesGcm,
			},
		},
	}
	keeperService, err := setupTestService(t, cfg)
	require.NoError(t, err)

	t.Run("GetKeepers should return a map with a sql keeper", func(t *testing.T) {
		keeperMap := keeperService.GetKeepers()
		require.NoError(t, err)

		assert.NotNil(t, keeperMap)
		assert.Equal(t, 1, len(keeperMap))
		assert.IsType(t, &sqlkeeper.SQLKeeper{}, keeperMap[contracts.SQLKeeperType])
	})
}

func setupTestService(t *testing.T, cfg *setting.Cfg) (OSSKeeperService, error) {
	// Initialize data key storage and encrypted value storage with a fake db
	testDB := db.InitTestDB(t)
	features := featuremgmt.WithFeatures(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs, featuremgmt.FlagSecretsManagementAppPlatform)

	dataKeyStore, err := encryptionstorage.ProvideDataKeyStorage(testDB, features)
	require.NoError(t, err)

	encValueStore, err := encryptionstorage.ProvideEncryptedValueStorage(testDB, features)
	require.NoError(t, err)

	encryptionManager, err := manager.ProvideEncryptionManager(tracing.InitializeTracerForTest(), dataKeyStore, cfg, &usagestats.UsageStatsMock{T: t}, nil)
	require.NoError(t, err)

	// Initialize the keeper service
	keeperService, err := ProvideService(tracing.InitializeTracerForTest(), encValueStore, encryptionManager)

	return keeperService, err
}
