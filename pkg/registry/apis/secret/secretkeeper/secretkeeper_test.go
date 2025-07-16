package secretkeeper

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"

	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption/cipher/service"
	osskmsproviders "github.com/grafana/grafana/pkg/registry/apis/secret/encryption/kmsproviders"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption/manager"
	"github.com/grafana/grafana/pkg/registry/apis/secret/secretkeeper/sqlkeeper"
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
			CurrentEncryptionProvider: "secret_key.v1",
			ConfiguredKMSProviders:    map[string]map[string]string{"secret_key.v1": {"secret_key": "SW2YcwTIb9zpOOhoPsMm"}},
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
	tracer := noop.NewTracerProvider().Tracer("test")
	database := database.ProvideDatabase(testDB, tracer)

	dataKeyStore, err := encryptionstorage.ProvideDataKeyStorage(database, tracer, nil)
	require.NoError(t, err)

	encValueStore, err := encryptionstorage.ProvideEncryptedValueStorage(database, tracer)
	require.NoError(t, err)

	usageStats := &usagestats.UsageStatsMock{T: t}
	enc, err := service.ProvideAESGCMCipherService(tracer, usageStats)
	require.NoError(t, err)

	ossProviders, err := osskmsproviders.ProvideOSSKMSProviders(cfg, enc)
	require.NoError(t, err)
	encryptionManager, err := manager.ProvideEncryptionManager(tracer, dataKeyStore, usageStats, enc, ossProviders)
	require.NoError(t, err)

	// Initialize the keeper service
	keeperService, err := ProvideService(tracer, encValueStore, encryptionManager, nil)

	return keeperService, err
}
