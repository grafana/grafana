package manager

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption"
	encryptionprovider "github.com/grafana/grafana/pkg/services/encryption/provider"
	encryptionservice "github.com/grafana/grafana/pkg/services/encryption/service"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/kmsproviders/osskmsproviders"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	encryptionstorage "github.com/grafana/grafana/pkg/storage/secret/encryption"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestEncryptionService_EnvelopeEncryption(t *testing.T) {
	svc := setupTestService(t)
	ctx := context.Background()
	namespace := "test-namespace"

	t.Run("encrypting with no entity_id should create DEK", func(t *testing.T) {
		plaintext := []byte("very secret string")

		encrypted, err := svc.Encrypt(context.Background(), namespace, plaintext, encryption.WithoutScope())
		require.NoError(t, err)

		decrypted, err := svc.Decrypt(context.Background(), namespace, encrypted)
		require.NoError(t, err)
		assert.Equal(t, plaintext, decrypted)

		keys, err := svc.store.GetAllDataKeys(ctx, namespace)
		require.NoError(t, err)
		assert.Equal(t, len(keys), 1)
	})

	t.Run("encrypting another secret with no entity_id should use the same DEK", func(t *testing.T) {
		plaintext := []byte("another very secret string")

		encrypted, err := svc.Encrypt(context.Background(), namespace, plaintext, encryption.WithoutScope())
		require.NoError(t, err)

		decrypted, err := svc.Decrypt(context.Background(), namespace, encrypted)
		require.NoError(t, err)
		assert.Equal(t, plaintext, decrypted)

		keys, err := svc.store.GetAllDataKeys(ctx, namespace)
		require.NoError(t, err)
		assert.Equal(t, len(keys), 1)
	})

	t.Run("encrypting with entity_id provided should create a new DEK", func(t *testing.T) {
		plaintext := []byte("some test data")

		encrypted, err := svc.Encrypt(context.Background(), namespace, plaintext, encryption.WithScope("user:100"))
		require.NoError(t, err)

		decrypted, err := svc.Decrypt(context.Background(), namespace, encrypted)
		require.NoError(t, err)
		assert.Equal(t, plaintext, decrypted)

		keys, err := svc.store.GetAllDataKeys(ctx, namespace)
		require.NoError(t, err)
		assert.Equal(t, len(keys), 2)
	})

	t.Run("usage stats should be registered", func(t *testing.T) {
		reports, err := svc.usageStats.GetUsageReport(context.Background())
		require.NoError(t, err)

		assert.Equal(t, 1, reports.Metrics["stats.encryption.current_provider.secretKey.count"])
		assert.Equal(t, 1, reports.Metrics["stats.encryption.providers.secretKey.count"])
	})
}

func TestEncryptionService_DataKeys(t *testing.T) {
	// Initialize data key storage with a fake db
	testDB := db.InitTestDB(t)
	features := featuremgmt.WithFeatures(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs, featuremgmt.FlagSecretsManagementAppPlatform)
	defaultKey := "SdlklWklckeLS"
	raw, err := ini.Load([]byte(`
		[security]
		secret_key = ` + defaultKey + `

		[security.encryption]
		data_keys_cache_ttl = 5m
		data_keys_cache_cleanup_interval = 1ns`))
	require.NoError(t, err)
	cfg := &setting.Cfg{Raw: raw}
	store, err := encryptionstorage.ProvideDataKeyStorageStorage(testDB, cfg, features)
	require.NoError(t, err)

	ctx := context.Background()
	namespace := "test-namespace"

	dataKey := &encryptionstorage.SecretDataKey{
		UID:           util.GenerateShortUID(),
		Label:         "test1",
		Active:        true,
		Provider:      "test",
		EncryptedData: []byte{0x62, 0xAF, 0xA1, 0x1A},
		Namespace:     namespace,
	}

	t.Run("querying for a DEK that does not exist", func(t *testing.T) {
		res, err := store.GetDataKey(ctx, namespace, dataKey.UID)
		assert.ErrorIs(t, encryptionstorage.ErrDataKeyNotFound, err)
		assert.Nil(t, res)
	})

	t.Run("creating an active DEK", func(t *testing.T) {
		err := store.CreateDataKey(ctx, dataKey)
		require.NoError(t, err)

		res, err := store.GetDataKey(ctx, namespace, dataKey.UID)
		require.NoError(t, err)
		assert.Equal(t, dataKey.EncryptedData, res.EncryptedData)
		assert.Equal(t, dataKey.Provider, res.Provider)
		assert.Equal(t, dataKey.Label, res.Label)
		assert.Equal(t, dataKey.UID, res.UID)
		assert.True(t, dataKey.Active)

		current, err := store.GetCurrentDataKey(ctx, namespace, dataKey.Label)
		require.NoError(t, err)
		assert.Equal(t, dataKey.EncryptedData, current.EncryptedData)
		assert.Equal(t, dataKey.Provider, current.Provider)
		assert.Equal(t, dataKey.Label, current.Label)
		assert.Equal(t, dataKey.UID, current.UID)
		assert.True(t, current.Active)
	})

	t.Run("creating an inactive DEK", func(t *testing.T) {
		k := &encryptionstorage.SecretDataKey{
			UID:           util.GenerateShortUID(),
			Namespace:     namespace,
			Active:        false,
			Label:         "test2",
			Provider:      "test",
			EncryptedData: []byte{0x62, 0xAF, 0xA1, 0x1A},
		}

		err := store.CreateDataKey(ctx, k)
		require.Error(t, err)

		res, err := store.GetDataKey(ctx, namespace, k.UID)
		assert.Equal(t, encryptionstorage.ErrDataKeyNotFound, err)
		assert.Nil(t, res)
	})

	t.Run("deleting DEK when no id provided must fail", func(t *testing.T) {
		beforeDelete, err := store.GetAllDataKeys(ctx, namespace)
		require.NoError(t, err)
		err = store.DeleteDataKey(ctx, namespace, "")
		require.Error(t, err)

		afterDelete, err := store.GetAllDataKeys(ctx, namespace)
		require.NoError(t, err)
		assert.Equal(t, beforeDelete, afterDelete)
	})

	t.Run("deleting a DEK", func(t *testing.T) {
		err := store.DeleteDataKey(ctx, namespace, dataKey.UID)
		require.NoError(t, err)

		res, err := store.GetDataKey(ctx, namespace, dataKey.UID)
		assert.Equal(t, encryptionstorage.ErrDataKeyNotFound, err)
		assert.Nil(t, res)
	})
}

func TestEncryptionService_UseCurrentProvider(t *testing.T) {
	t.Run("When encryption_provider is not specified explicitly, should use 'secretKey' as a current provider", func(t *testing.T) {
		svc := setupTestService(t)
		assert.Equal(t, encryption.ProviderID("secretKey.v1"), svc.currentProviderID)
	})

	t.Run("Should use encrypt/decrypt methods of the current encryption provider", func(t *testing.T) {
		rawCfg := `
		[security]
		secret_key = sdDkslslld
		encryption_provider = fakeProvider.v1
		available_encryption_providers = fakeProvider.v1

		[security.encryption.fakeProvider.v1]
		`

		raw, err := ini.Load([]byte(rawCfg))
		require.NoError(t, err)

		cfg := &setting.Cfg{Raw: raw}

		encProvider := encryptionprovider.Provider{}
		usageStats := &usagestats.UsageStatsMock{}

		encryptionService, err := encryptionservice.ProvideEncryptionService(tracing.InitializeTracerForTest(), encProvider, usageStats, cfg)
		require.NoError(t, err)

		features := featuremgmt.WithFeatures(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs, featuremgmt.FlagSecretsManagementAppPlatform)
		kms := newFakeKMS(osskmsproviders.ProvideService(encryptionService, cfg, features))
		testDB := db.InitTestDB(t)
		encryptionStore, err := encryptionstorage.ProvideDataKeyStorageStorage(testDB, &setting.Cfg{}, features)
		require.NoError(t, err)

		encryptionManager, err := NewEncryptionManager(
			tracing.InitializeTracerForTest(),
			encryptionStore,
			&kms,
			encryptionService,
			cfg,
			&usagestats.UsageStatsMock{T: t},
		)
		require.NoError(t, err)

		assert.Equal(t, encryption.ProviderID("fakeProvider.v1"), encryptionManager.currentProviderID)
		assert.Equal(t, 2, len(encryptionManager.GetProviders()))

		namespace := "test-namespace"
		encrypted, _ := encryptionManager.Encrypt(context.Background(), namespace, []byte{}, encryption.WithoutScope())
		assert.True(t, kms.fake.encryptCalled)

		// encryption manager tries to find a DEK in a cache first before calling provider's decrypt
		// to bypass the cache, we set up one more secrets service to test decrypting
		svcDecrypt, err := NewEncryptionManager(
			tracing.InitializeTracerForTest(),
			encryptionStore,
			&kms,
			encryptionService,
			cfg,
			&usagestats.UsageStatsMock{T: t},
		)
		require.NoError(t, err)

		_, _ = svcDecrypt.Decrypt(context.Background(), namespace, encrypted)
		assert.True(t, kms.fake.decryptCalled, "fake provider's decrypt should be called")
	})
}

type fakeProvider struct {
	encryptCalled bool
	decryptCalled bool
}

func (p *fakeProvider) Encrypt(_ context.Context, _ []byte) ([]byte, error) {
	p.encryptCalled = true
	return []byte{}, nil
}

func (p *fakeProvider) Decrypt(_ context.Context, _ []byte) ([]byte, error) {
	p.decryptCalled = true
	return []byte{}, nil
}

type fakeKMS struct {
	kms  osskmsproviders.Service
	fake *fakeProvider
}

func newFakeKMS(kms osskmsproviders.Service) fakeKMS {
	return fakeKMS{
		kms:  kms,
		fake: &fakeProvider{},
	}
}

func (f *fakeKMS) Provide() (map[secrets.ProviderID]secrets.Provider, error) {
	providers, err := f.kms.Provide()
	if err != nil {
		return providers, err
	}

	providers["fakeProvider.v1"] = f.fake
	return providers, nil
}

func TestEncryptionService_Run(t *testing.T) {
	svc := setupTestService(t)
	ctx := context.Background()
	namespace := "test-namespace"

	t.Run("should stop with no error once the context's finished", func(t *testing.T) {
		ctx, cancel := context.WithTimeout(ctx, time.Millisecond)
		defer cancel()

		err := svc.Run(ctx)
		assert.NoError(t, err)
	})

	t.Run("should trigger cache clean up", func(t *testing.T) {
		restoreTimeNowAfterTestExec(t)

		// Encrypt to force data encryption key generation
		encrypted, err := svc.Encrypt(ctx, namespace, []byte("grafana"), encryption.WithoutScope())
		require.NoError(t, err)

		// Ten minutes later (after caution period)
		// Look SecretsService.cacheDataKey for more details.
		now = func() time.Time { return time.Now().Add(10 * time.Minute) }

		// Decrypt to ensure data encryption key is cached
		_, err = svc.Decrypt(ctx, namespace, encrypted)
		require.NoError(t, err)

		// Data encryption key cache should contain one element
		require.Len(t, svc.dataKeyCache.namespacedCaches[namespace].byId, 1)
		require.Len(t, svc.dataKeyCache.namespacedCaches[namespace].byLabel, 1)

		// Twenty minutes later (after caution period + cache ttl)
		now = func() time.Time { return time.Now().Add(20 * time.Minute) }

		ctx, cancel := context.WithTimeout(ctx, 1*time.Second)
		defer cancel()

		err = svc.Run(ctx)
		require.NoError(t, err)

		// Then, once the ticker has been triggered,
		// the cleanup process should have happened,
		// therefore the cache should be empty.
		require.Len(t, svc.dataKeyCache.namespacedCaches[namespace].byId, 0)
		require.Len(t, svc.dataKeyCache.namespacedCaches[namespace].byLabel, 0)
	})
}

func TestEncryptionService_ReEncryptDataKeys(t *testing.T) {
	t.Skip() // TODO: skipped since reencrypt is not fully working, unskip when fixed

	svc := setupTestService(t)
	ctx := context.Background()
	namespace := "test-namespace"

	// Encrypt to generate data encryption key
	withoutScope := encryption.WithoutScope()
	ciphertext, err := svc.Encrypt(ctx, namespace, []byte("grafana"), withoutScope)
	require.NoError(t, err)

	t.Run("existing key should be re-encrypted", func(t *testing.T) {
		prevDataKeys, err := svc.store.GetAllDataKeys(ctx, namespace)
		require.NoError(t, err)
		require.Len(t, prevDataKeys, 1)

		err = svc.ReEncryptDataKeys(ctx, namespace)
		require.NoError(t, err)

		reEncryptedDataKeys, err := svc.store.GetAllDataKeys(ctx, namespace)
		require.NoError(t, err)
		require.Len(t, reEncryptedDataKeys, 1)

		assert.NotEqual(t, prevDataKeys[0].EncryptedData, reEncryptedDataKeys[0].EncryptedData)
	})

	t.Run("data keys cache should be invalidated", func(t *testing.T) {
		restoreTimeNowAfterTestExec(t)

		// Ten minutes later (after caution period)
		// Look SecretsService.cacheDataKey for more details.
		now = func() time.Time { return time.Now().Add(10 * time.Minute) }

		// Decrypt to ensure data key is cached
		_, err := svc.Decrypt(ctx, namespace, ciphertext)
		require.NoError(t, err)
		require.NotEmpty(t, svc.dataKeyCache.namespacedCaches[namespace].byId)
		require.NotEmpty(t, svc.dataKeyCache.namespacedCaches[namespace].byLabel)

		err = svc.ReEncryptDataKeys(ctx, namespace)
		require.NoError(t, err)

		assert.Empty(t, svc.dataKeyCache.namespacedCaches[namespace].byId)
		assert.Empty(t, svc.dataKeyCache.namespacedCaches[namespace].byLabel)
	})
}

func TestEncryptionService_Decrypt(t *testing.T) {
	ctx := context.Background()
	namespace := "test-namespace"

	t.Run("empty payload should fail", func(t *testing.T) {
		svc := setupTestService(t)
		_, err := svc.Decrypt(context.Background(), namespace, []byte(""))
		require.Error(t, err)

		assert.Equal(t, "unable to decrypt empty payload", err.Error())
	})

	t.Run("ee encrypted payload with ee enabled should work", func(t *testing.T) {
		svc := setupTestService(t)
		ciphertext, err := svc.Encrypt(ctx, namespace, []byte("grafana"), encryption.WithoutScope())
		require.NoError(t, err)

		plaintext, err := svc.Decrypt(ctx, namespace, ciphertext)
		assert.NoError(t, err)
		assert.Equal(t, []byte("grafana"), plaintext)
	})
}

func TestIntegration_SecretsService(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx := context.Background()
	someData := []byte(`some-data`)
	namespace := "test-namespace"

	tcs := map[string]func(*testing.T, db.DB, *EncryptionManager){
		"regular": func(t *testing.T, _ db.DB, svc *EncryptionManager) {
			// We encrypt some data normally, no transactions implied.
			_, err := svc.Encrypt(ctx, namespace, someData, encryption.WithoutScope())
			require.NoError(t, err)
		},
		"within successful InTransaction": func(t *testing.T, store db.DB, svc *EncryptionManager) {
			require.NoError(t, store.InTransaction(ctx, func(ctx context.Context) error {
				// We encrypt some data within a transaction that shares the db session.
				_, err := svc.Encrypt(ctx, namespace, someData, encryption.WithoutScope())
				require.NoError(t, err)

				// And the transition succeeds.
				return nil
			}))
		},
		"within unsuccessful InTransaction": func(t *testing.T, store db.DB, svc *EncryptionManager) {
			require.NotNil(t, store.InTransaction(ctx, func(ctx context.Context) error {
				// We encrypt some data within a transaction that shares the db session.
				_, err := svc.Encrypt(ctx, namespace, someData, encryption.WithoutScope())
				require.NoError(t, err)

				// But the transaction fails.
				return errors.New("error")
			}))
		},
		"within unsuccessful InTransaction (plus forced db fetch)": func(t *testing.T, store db.DB, svc *EncryptionManager) {
			require.NotNil(t, store.InTransaction(ctx, func(ctx context.Context) error {
				// We encrypt some data within a transaction that shares the db session.
				encrypted, err := svc.Encrypt(ctx, namespace, someData, encryption.WithoutScope())
				require.NoError(t, err)

				// At this point the data key is not cached yet because
				// the transaction haven't been committed yet,
				// and won't, so we do a decrypt operation within the
				// transaction to force the data key to be
				// (potentially) cached (it shouldn't to prevent issues).
				decrypted, err := svc.Decrypt(ctx, namespace, encrypted)
				require.NoError(t, err)
				assert.Equal(t, someData, decrypted)

				// But the transaction fails.
				return errors.New("error")
			}))
		},
		"within successful WithTransactionalDbSession": func(t *testing.T, store db.DB, svc *EncryptionManager) {
			require.NoError(t, store.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
				// We encrypt some data within a transaction that does not share the db session.
				_, err := svc.Encrypt(ctx, namespace, someData, encryption.WithoutScope())
				require.NoError(t, err)

				// And the transition succeeds.
				return nil
			}))
		},
		"within unsuccessful WithTransactionalDbSession": func(t *testing.T, store db.DB, svc *EncryptionManager) {
			require.NotNil(t, store.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
				// We encrypt some data within a transaction that does not share the db session.
				_, err := svc.Encrypt(ctx, namespace, someData, encryption.WithoutScope())
				require.NoError(t, err)

				// But the transaction fails.
				return errors.New("error")
			}))
		},
		"within unsuccessful WithTransactionalDbSession (plus forced db fetch)": func(t *testing.T, store db.DB, svc *EncryptionManager) {
			require.NotNil(t, store.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
				// We encrypt some data within a transaction that does not share the db session.
				encrypted, err := svc.Encrypt(ctx, namespace, someData, encryption.WithoutScope())
				require.NoError(t, err)

				// At this point the data key is not cached yet because
				// the transaction haven't been committed yet,
				// and won't, so we do a decrypt operation within the
				// transaction to force the data key to be
				// (potentially) cached (it shouldn't to prevent issues).
				decrypted, err := svc.Decrypt(ctx, namespace, encrypted)
				require.NoError(t, err)
				assert.Equal(t, someData, decrypted)

				// But the transaction fails.
				return errors.New("error")
			}))
		},
	}

	for name, tc := range tcs {
		t.Run(name, func(t *testing.T) {
			testDB := db.InitTestDB(t)
			features := featuremgmt.WithFeatures(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs, featuremgmt.FlagSecretsManagementAppPlatform)
			defaultKey := "SdlklWklckeLS"
			raw, err := ini.Load([]byte(`
				[security]
				secret_key = ` + defaultKey + `
		
				[security.encryption]
				data_keys_cache_ttl = 5m
				data_keys_cache_cleanup_interval = 1ns`))
			require.NoError(t, err)

			cfg := &setting.Cfg{Raw: raw}
			store, err := encryptionstorage.ProvideDataKeyStorageStorage(testDB, cfg, features)
			require.NoError(t, err)

			encProvider := encryptionprovider.Provider{}
			usageStats := &usagestats.UsageStatsMock{T: t}

			enc, err := encryptionservice.ProvideEncryptionService(tracing.InitializeTracerForTest(), encProvider, usageStats, cfg)
			require.NoError(t, err)

			svc, err := NewEncryptionManager(
				tracing.InitializeTracerForTest(),
				store,
				osskmsproviders.ProvideService(enc, cfg, features),
				enc,
				cfg,
				usageStats,
			)
			require.NoError(t, err)

			ctx := context.Background()
			namespace := "test-namespace"

			// Here's what actually matters and varies on each test: look at the test case name.
			//
			// For historical reasons, and in an old implementation, when a successful encryption
			// operation happened within an unsuccessful transaction, the data key was used to be
			// cached in memory for the next encryption operations, which caused some data to be
			// encrypted with a data key that haven't actually been persisted into the database.
			tc(t, testDB, svc)
			// Therefore, the data encrypted after this point, become unrecoverable after a restart.
			// So, the different test cases here are there to prevent that from happening again
			// in the future, whatever it is what happens.

			// So, we proceed with an encryption operation:
			toEncrypt := []byte(`data-to-encrypt`)
			encrypted, err := svc.Encrypt(ctx, namespace, toEncrypt, encryption.WithoutScope())
			require.NoError(t, err)

			// We simulate an instance restart. So, there's no data in the in-memory cache.
			svc.dataKeyCache.flush(namespace)

			// And then, we MUST still be able to decrypt the previously encrypted data:
			decrypted, err := svc.Decrypt(ctx, namespace, encrypted)
			require.NoError(t, err)
			assert.Equal(t, toEncrypt, decrypted)
		})
	}
}

// Use this function at the beginning of those tests
// that manipulates 'now', so it'll leave it in a
// correct state once test execution finishes.
func restoreTimeNowAfterTestExec(t *testing.T) {
	t.Helper()
	t.Cleanup(func() { now = time.Now })
}
