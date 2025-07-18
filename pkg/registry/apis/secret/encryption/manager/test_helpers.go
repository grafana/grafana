package manager

import (
	"testing"

	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"

	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption/cipher/service"
	osskmsproviders "github.com/grafana/grafana/pkg/registry/apis/secret/encryption/kmsproviders"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/secret/database"
	encryptionstorage "github.com/grafana/grafana/pkg/storage/secret/encryption"
	"github.com/grafana/grafana/pkg/storage/secret/migrator"
)

func setupTestService(tb testing.TB) *EncryptionManager {
	tb.Helper()

	testDB := sqlstore.NewTestStore(tb, sqlstore.WithMigrator(migrator.New()))
	tracer := noop.NewTracerProvider().Tracer("test")
	database := database.ProvideDatabase(testDB, tracer)

	defaultKey := "SdlklWklckeLS"
	cfg := &setting.Cfg{
		SecretsManagement: setting.SecretsManagerSettings{
			CurrentEncryptionProvider: "secret_key.v1",
			ConfiguredKMSProviders:    map[string]map[string]string{"secret_key.v1": {"secret_key": defaultKey}},
		},
	}
	store, err := encryptionstorage.ProvideDataKeyStorage(database, tracer, nil)
	require.NoError(tb, err)

	usageStats := &usagestats.UsageStatsMock{T: tb}

	enc, err := service.ProvideAESGCMCipherService(tracer, usageStats)
	require.NoError(tb, err)

	ossProviders, err := osskmsproviders.ProvideOSSKMSProviders(cfg, enc)
	require.NoError(tb, err)

	encMgr, err := ProvideEncryptionManager(
		tracer,
		store,
		usageStats,
		enc,
		ossProviders,
	)
	require.NoError(tb, err)

	return encMgr.(*EncryptionManager)
}
