package nats_test

import (
	"encoding/json"
	"sync"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/nats"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/registry/apis/secret"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	cipherservice "github.com/grafana/grafana/pkg/registry/apis/secret/encryption/cipher/service"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption/kmsproviders"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption/manager"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"github.com/grafana/grafana/pkg/setting"
	secretdatabase "github.com/grafana/grafana/pkg/storage/secret/database"
	"github.com/grafana/grafana/pkg/storage/secret/encryption"
	"github.com/grafana/grafana/pkg/storage/secret/migrator"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// TestIntegrationRouteCredentialSecretsManager runs instances on one database
// with the Secrets Manager encryption Grafana wires, as the internal tests
// cannot import it.
func TestIntegrationRouteCredentialSecretsManager(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	sqlStore := db.NewTestStore(t)
	nats.DeleteRouteCredential(t, sqlStore)
	cfg := nats.NewEmbeddedTestCfg("127.0.0.1")
	cfg.SecretsManagement.RunSecretsDBMigrations = true
	migrated, err := secret.ProvideDatabaseMigrated(cfg, migrator.NewWithEngine(sqlStore))
	require.NoError(t, err)

	newInstance := func(t *testing.T, secretKey string) (*nats.Server, contracts.EncryptionManager) {
		enc := newEncryptionManager(t, sqlStore, secretKey)
		s, err := nats.ProvideServer(cfg, sqlStore, enc, migrated, prometheus.NewRegistry())
		require.NoError(t, err)
		return s, enc
	}

	// Both instances start together on a database without a credential.
	var a, b *nats.Server
	var encA contracts.EncryptionManager
	var wg sync.WaitGroup
	wg.Go(func() { a, encA = newInstance(t, "nats-test-secret-key") })
	wg.Go(func() { b, _ = newInstance(t, "nats-test-secret-key") })
	wg.Wait()
	require.NotNil(t, nats.RouteCredential(a))
	require.Equal(t, nats.RouteCredential(a), nats.RouteCredential(b))
	pass, _ := nats.RouteCredential(a).Password()

	var row string
	require.NoError(t, sqlStore.WithDbSession(t.Context(), func(sess *db.Session) error {
		_, err := sess.SQL("SELECT value FROM nats_discovery_peers WHERE key_path = ?", nats.RouteCredentialKeyPath).Get(&row)
		return err
	}))
	require.NotEmpty(t, row)
	require.NotContains(t, row, pass)
	var sealed contracts.EncryptedPayload
	require.NoError(t, json.Unmarshal([]byte(row), &struct {
		DataKeyID     *string `json:"data_key_id"`
		EncryptedData *[]byte `json:"encrypted_data"`
	}{&sealed.DataKeyID, &sealed.EncryptedData}))
	plain, err := encA.Decrypt(t.Context(), xkube.Namespace("default"), sealed, contracts.EncryptionOption{})
	require.NoError(t, err)
	require.Equal(t, pass, string(plain))

	nats.StartService(t, a)
	nats.StartService(t, b)
	nats.RequireDelivery(t, a, b)

	// An instance with another key encryption key starts but cannot use it.
	c, _ := newInstance(t, "another-secret-key")
	require.Nil(t, nats.RouteCredential(c))
	nats.StartService(t, c)
	require.NoError(t, c.Health(t.Context()))
}

// newEncryptionManager builds the Secrets Manager encryption of one instance
// on sqlStore, with its data keys encrypted under secretKey.
func newEncryptionManager(t *testing.T, sqlStore db.DB, secretKey string) contracts.EncryptionManager {
	t.Helper()
	cfg := setting.NewCfg()
	cfg.SecretsManagement.CurrentEncryptionProvider = "secret_key.v1"
	cfg.SecretsManagement.ConfiguredKMSProviders = map[string]map[string]string{"secret_key.v1": {"secret_key": secretKey}}
	tracer := noop.NewTracerProvider().Tracer("test")
	store, err := encryption.ProvideDataKeyStorage(secretdatabase.ProvideDatabase(sqlStore, tracer), tracer, prometheus.NewRegistry())
	require.NoError(t, err)
	usage := &usagestats.UsageStatsMock{}
	aesgcm, err := cipherservice.ProvideAESGCMCipherService(tracer, usage)
	require.NoError(t, err)
	providers, err := kmsproviders.ProvideOSSKMSProviders(cfg, aesgcm)
	require.NoError(t, err)
	enc, err := manager.ProvideEncryptionManager(tracer, store, usage, aesgcm, providers, manager.ProvideOSSDataKeyCache(tracer, cfg), cfg)
	require.NoError(t, err)
	return enc
}
