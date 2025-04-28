package secretkeeper

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption/cipher"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption/manager"
	"github.com/grafana/grafana/pkg/registry/apis/secret/secretkeeper/sqlkeeper"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/secret/database"
	encryptionstorage "github.com/grafana/grafana/pkg/storage/secret/encryption"
	"github.com/grafana/grafana/pkg/storage/secret/migrator"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func Test_OSSKeeperService(t *testing.T) {
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

	t.Run("KeeperForConfig should return the system keeper", func(t *testing.T) {
		keeper, err := keeperService.KeeperForConfig(nil)
		require.NoError(t, err)

		assert.NotNil(t, keeper)
		assert.IsType(t, &sqlkeeper.SQLKeeper{}, keeper)
	})
}

func setupTestService(t *testing.T, cfg *setting.Cfg) (*OSSKeeperService, error) {
	// Initialize data key storage and encrypted value storage with a fake db
	testDB := sqlstore.NewTestStore(t, sqlstore.WithMigrator(migrator.New()))
	database := database.ProvideDatabase(testDB)
	features := featuremgmt.WithFeatures(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs, featuremgmt.FlagSecretsManagementAppPlatform)

	dataKeyStore, err := encryptionstorage.ProvideDataKeyStorage(testDB, features)
	require.NoError(t, err)

	encValueStore, err := encryptionstorage.ProvideEncryptedValueStorage(database, features)
	require.NoError(t, err)

	encryptionManager, err := manager.ProvideEncryptionManager(tracing.InitializeTracerForTest(), dataKeyStore, cfg, &usagestats.UsageStatsMock{T: t}, nil)
	require.NoError(t, err)

	// Initialize the keeper service
	keeperService, err := ProvideService(tracing.InitializeTracerForTest(), encValueStore, encryptionManager)

	return keeperService, err
}
