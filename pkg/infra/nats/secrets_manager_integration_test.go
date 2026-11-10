package nats_test

import (
	"context"
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
	"github.com/grafana/grafana/pkg/registry/apis/secret/service"
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

	sqlStore, migrated := newSecretsTestDB(t)
	values := newEncryptedValues(t, sqlStore)
	newInstance := func(t *testing.T, secretKey string) (*nats.Server, contracts.EncryptionManager) {
		enc := newEncryptionManager(t, sqlStore, secretKey)
		s, err := nats.ProvideServer(cfg(), sqlStore, enc, values, migrated, prometheus.NewRegistry())
		require.NoError(t, err)
		return s, enc
	}

	// Instances start together on a database without a credential.
	servers := make([]*nats.Server, 4)
	encryption := make([]contracts.EncryptionManager, len(servers))
	var wg sync.WaitGroup
	for i := range servers {
		wg.Go(func() { servers[i], encryption[i] = newInstance(t, "nats-test-secret-key") })
	}
	wg.Wait()
	a, b := servers[0], servers[1]
	require.NotNil(t, nats.RouteCredential(a))
	for _, s := range servers {
		require.Equal(t, nats.RouteCredential(a), nats.RouteCredential(s))
	}
	pass, _ := nats.RouteCredential(a).Password()

	stored, err := values.Get(t.Context(), "default", nats.RouteCredentialName, nats.RouteCredentialVersion)
	require.NoError(t, err)
	require.NotContains(t, string(stored.EncryptedData), pass)
	plain, err := encryption[0].Decrypt(t.Context(), "default", stored.EncryptedPayload, contracts.EncryptionOption{})
	require.NoError(t, err)
	require.Equal(t, pass, string(plain))
	var peerRows []string
	require.NoError(t, sqlStore.WithDbSession(t.Context(), func(sess *db.Session) error {
		return sess.SQL("SELECT value FROM nats_discovery_peers").Find(&peerRows)
	}))
	for _, row := range peerRows {
		require.NotContains(t, row, pass)
	}

	nats.StartService(t, a)
	nats.StartService(t, b)
	nats.RequireDelivery(t, a, b)

	// An instance with another key encryption key starts but cannot use it.
	c, _ := newInstance(t, "another-secret-key")
	require.Nil(t, nats.RouteCredential(c))
	nats.StartService(t, c)
	require.NoError(t, c.Health(t.Context()))
}

// TestIntegrationRouteCredentialSurvivesProviderRotation follows the
// encryption provider rotation: switch to a new provider while the old one is
// still configured, consolidate, then retire the old provider.
func TestIntegrationRouteCredentialSurvivesProviderRotation(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	sqlStore, migrated := newSecretsTestDB(t)
	values := newEncryptedValues(t, sqlStore)
	oldProvider := map[string]string{"secret_key.v1": "old-secret-key"}
	bothProviders := map[string]string{"secret_key.v1": "old-secret-key", "secret_key.v2": "new-secret-key"}
	newProvider := map[string]string{"secret_key.v2": "new-secret-key"}
	start := func(enc contracts.EncryptionManager) *nats.Server {
		s, err := nats.ProvideServer(cfg(), sqlStore, enc, values, migrated, prometheus.NewRegistry())
		require.NoError(t, err)
		return s
	}

	created := nats.RouteCredential(start(newEncryptionManagerWith(t, sqlStore, "secret_key.v1", oldProvider)))
	require.NotNil(t, created)

	before, err := values.Get(t.Context(), "default", nats.RouteCredentialName, nats.RouteCredentialVersion)
	require.NoError(t, err)
	rotated := newEncryptionManagerWith(t, sqlStore, "secret_key.v2", bothProviders)
	consolidate(t, sqlStore, rotated)
	after, err := values.Get(t.Context(), "default", nats.RouteCredentialName, nats.RouteCredentialVersion)
	require.NoError(t, err)
	require.NotEqual(t, before.DataKeyID, after.DataKeyID, "consolidation did not re-encrypt the credential")

	restarted := start(newEncryptionManagerWith(t, sqlStore, "secret_key.v2", newProvider))
	require.Equal(t, created, nats.RouteCredential(restarted), "the credential did not survive the rotation")
}

func cfg() *setting.Cfg { return nats.NewEmbeddedTestCfg("127.0.0.1") }

// newSecretsTestDB returns a test database with the Secrets Manager tables
// and without a route credential left by another test.
func newSecretsTestDB(t *testing.T) (db.DB, *contracts.SecretDBMigrated) {
	t.Helper()
	sqlStore := db.NewTestStore(t)
	c := cfg()
	c.SecretsManagement.RunSecretsDBMigrations = true
	migrated, err := secret.ProvideDatabaseMigrated(c, migrator.NewWithEngine(sqlStore))
	require.NoError(t, err)
	deleteCredential := func(ctx context.Context) {
		require.NoError(t, sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
			_, err := sess.Exec("DELETE FROM secret_encrypted_value WHERE name = ?", nats.RouteCredentialName)
			return err
		}))
	}
	deleteCredential(t.Context())
	t.Cleanup(func() { deleteCredential(context.Background()) })
	return sqlStore, migrated
}

func newEncryptedValues(t *testing.T, sqlStore db.DB) contracts.EncryptedValueStorage {
	t.Helper()
	values, err := encryption.ProvideEncryptedValueStorage(secretdatabase.ProvideDatabase(sqlStore, noop.NewTracerProvider().Tracer("test")), noop.NewTracerProvider().Tracer("test"))
	require.NoError(t, err)
	return values
}

// consolidate re-encrypts every encrypted value with the current provider, as
// the secrets-consolidation command does.
func consolidate(t *testing.T, sqlStore db.DB, enc contracts.EncryptionManager) {
	t.Helper()
	tracer := noop.NewTracerProvider().Tracer("test")
	database := secretdatabase.ProvideDatabase(sqlStore, tracer)
	dataKeys, err := encryption.ProvideGlobalDataKeyStorage(database, tracer, prometheus.NewRegistry())
	require.NoError(t, err)
	values, err := encryption.ProvideEncryptedValueStorage(database, tracer)
	require.NoError(t, err)
	allValues, err := encryption.ProvideGlobalEncryptedValueStorage(database, tracer)
	require.NoError(t, err)
	require.NoError(t, service.ProvideConsolidationService(tracer, dataKeys, values, allValues, enc).Consolidate(t.Context(), nil))
}

// newEncryptionManager builds the Secrets Manager encryption of one instance
// on sqlStore, with its data keys encrypted under secretKey.
func newEncryptionManager(t *testing.T, sqlStore db.DB, secretKey string) contracts.EncryptionManager {
	t.Helper()
	return newEncryptionManagerWith(t, sqlStore, "secret_key.v1", map[string]string{"secret_key.v1": secretKey})
}

// newEncryptionManagerWith builds it with the given secret_key providers,
// encrypting new data keys with current.
func newEncryptionManagerWith(t *testing.T, sqlStore db.DB, current string, providers map[string]string) contracts.EncryptionManager {
	t.Helper()
	cfg := setting.NewCfg()
	cfg.SecretsManagement.CurrentEncryptionProvider = current
	cfg.SecretsManagement.ConfiguredKMSProviders = map[string]map[string]string{}
	for name, key := range providers {
		cfg.SecretsManagement.ConfiguredKMSProviders[name] = map[string]string{"secret_key": key}
	}
	tracer := noop.NewTracerProvider().Tracer("test")
	store, err := encryption.ProvideDataKeyStorage(secretdatabase.ProvideDatabase(sqlStore, tracer), tracer, prometheus.NewRegistry())
	require.NoError(t, err)
	usage := &usagestats.UsageStatsMock{}
	aesgcm, err := cipherservice.ProvideAESGCMCipherService(tracer, usage)
	require.NoError(t, err)
	providerCfg, err := kmsproviders.ProvideOSSKMSProviders(cfg, aesgcm)
	require.NoError(t, err)
	enc, err := manager.ProvideEncryptionManager(tracer, store, usage, aesgcm, providerCfg, manager.ProvideOSSDataKeyCache(tracer, cfg), cfg)
	require.NoError(t, err)
	return enc
}
