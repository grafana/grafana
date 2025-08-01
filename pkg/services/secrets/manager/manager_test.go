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
	encryptionprovider "github.com/grafana/grafana/pkg/services/encryption/provider"
	encryptionservice "github.com/grafana/grafana/pkg/services/encryption/service"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/kmsproviders/osskmsproviders"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/secrets/database"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationSecretsService_EnvelopeEncryption(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	testDB := db.InitTestDB(t)
	store := database.ProvideSecretsStore(testDB)
	svc := SetupTestService(t, store)
	ctx := context.Background()

	t.Run("encrypting with no entity_id should create DEK", func(t *testing.T) {
		plaintext := []byte("very secret string")

		encrypted, err := svc.Encrypt(context.Background(), plaintext, secrets.WithoutScope())
		require.NoError(t, err)

		decrypted, err := svc.Decrypt(context.Background(), encrypted)
		require.NoError(t, err)
		assert.Equal(t, plaintext, decrypted)

		keys, err := store.GetAllDataKeys(ctx)
		require.NoError(t, err)
		assert.Equal(t, len(keys), 1)
	})

	t.Run("encrypting another secret with no entity_id should use the same DEK", func(t *testing.T) {
		plaintext := []byte("another very secret string")

		encrypted, err := svc.Encrypt(context.Background(), plaintext, secrets.WithoutScope())
		require.NoError(t, err)

		decrypted, err := svc.Decrypt(context.Background(), encrypted)
		require.NoError(t, err)
		assert.Equal(t, plaintext, decrypted)

		keys, err := store.GetAllDataKeys(ctx)
		require.NoError(t, err)
		assert.Equal(t, len(keys), 1)
	})

	t.Run("encrypting with entity_id provided should create a new DEK", func(t *testing.T) {
		plaintext := []byte("some test data")

		encrypted, err := svc.Encrypt(context.Background(), plaintext, secrets.WithScope("user:100"))
		require.NoError(t, err)

		decrypted, err := svc.Decrypt(context.Background(), encrypted)
		require.NoError(t, err)
		assert.Equal(t, plaintext, decrypted)

		keys, err := store.GetAllDataKeys(ctx)
		require.NoError(t, err)
		assert.Equal(t, len(keys), 2)
	})

	t.Run("usage stats should be registered", func(t *testing.T) {
		reports, err := svc.usageStats.GetUsageReport(context.Background())
		require.NoError(t, err)

		assert.Equal(t, 1, reports.Metrics["stats.encryption.envelope_encryption_enabled.count"])
		assert.Equal(t, 1, reports.Metrics["stats.encryption.current_provider.secretKey.count"])
		assert.Equal(t, 1, reports.Metrics["stats.encryption.providers.secretKey.count"])
	})
}

func TestIntegrationSecretsService_DataKeys(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	testDB := db.InitTestDB(t)
	store := database.ProvideSecretsStore(testDB)
	ctx := context.Background()

	dataKey := &secrets.DataKey{
		Id:            util.GenerateShortUID(),
		Label:         "test1",
		Active:        true,
		Provider:      "test",
		EncryptedData: []byte{0x62, 0xAF, 0xA1, 0x1A},
	}

	t.Run("querying for a DEK that does not exist", func(t *testing.T) {
		res, err := store.GetDataKey(ctx, dataKey.Id)
		assert.ErrorIs(t, secrets.ErrDataKeyNotFound, err)
		assert.Nil(t, res)
	})

	t.Run("creating an active DEK", func(t *testing.T) {
		err := store.CreateDataKey(ctx, dataKey)
		require.NoError(t, err)

		res, err := store.GetDataKey(ctx, dataKey.Id)
		require.NoError(t, err)
		assert.Equal(t, dataKey.EncryptedData, res.EncryptedData)
		assert.Equal(t, dataKey.Provider, res.Provider)
		assert.Equal(t, dataKey.Label, res.Label)
		assert.Equal(t, dataKey.Id, res.Id)
		assert.True(t, dataKey.Active)

		current, err := store.GetCurrentDataKey(ctx, dataKey.Label)
		require.NoError(t, err)
		assert.Equal(t, dataKey.EncryptedData, current.EncryptedData)
		assert.Equal(t, dataKey.Provider, current.Provider)
		assert.Equal(t, dataKey.Label, current.Label)
		assert.Equal(t, dataKey.Id, current.Id)
		assert.True(t, current.Active)
	})

	t.Run("creating an inactive DEK", func(t *testing.T) {
		k := &secrets.DataKey{
			Id:            util.GenerateShortUID(),
			Active:        false,
			Label:         "test2",
			Provider:      "test",
			EncryptedData: []byte{0x62, 0xAF, 0xA1, 0x1A},
		}

		err := store.CreateDataKey(ctx, k)
		require.Error(t, err)

		res, err := store.GetDataKey(ctx, k.Id)
		assert.Equal(t, secrets.ErrDataKeyNotFound, err)
		assert.Nil(t, res)
	})

	t.Run("deleting DEK when no id provided must fail", func(t *testing.T) {
		beforeDelete, err := store.GetAllDataKeys(ctx)
		require.NoError(t, err)
		err = store.DeleteDataKey(ctx, "")
		require.Error(t, err)

		afterDelete, err := store.GetAllDataKeys(ctx)
		require.NoError(t, err)
		assert.Equal(t, beforeDelete, afterDelete)
	})

	t.Run("deleting a DEK", func(t *testing.T) {
		err := store.DeleteDataKey(ctx, dataKey.Id)
		require.NoError(t, err)

		res, err := store.GetDataKey(ctx, dataKey.Id)
		assert.Equal(t, secrets.ErrDataKeyNotFound, err)
		assert.Nil(t, res)
	})
}

func TestIntegrationSecretsService_UseCurrentProvider(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	t.Run("When encryption_provider is not specified explicitly, should use 'secretKey' as a current provider", func(t *testing.T) {
		testDB := db.InitTestDB(t)
		svc := SetupTestService(t, database.ProvideSecretsStore(testDB))
		assert.Equal(t, secrets.ProviderID("secretKey.v1"), svc.currentProviderID)
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

		features := featuremgmt.WithFeatures()
		kms := newFakeKMS(osskmsproviders.ProvideService(encryptionService, cfg, features))
		testDB := db.InitTestDB(t)
		secretStore := database.ProvideSecretsStore(testDB)

		secretsService, err := ProvideSecretsService(
			tracing.InitializeTracerForTest(),
			secretStore,
			&kms,
			encryptionService,
			cfg,
			features,
			&usagestats.UsageStatsMock{T: t},
		)
		require.NoError(t, err)

		assert.Equal(t, secrets.ProviderID("fakeProvider.v1"), secretsService.currentProviderID)
		assert.Equal(t, 2, len(secretsService.GetProviders()))

		encrypted, _ := secretsService.Encrypt(context.Background(), []byte{}, secrets.WithoutScope())
		assert.True(t, kms.fake.encryptCalled)

		// secret service tries to find a DEK in a cache first before calling provider's decrypt
		// to bypass the cache, we set up one more secrets service to test decrypting
		svcDecrypt, err := ProvideSecretsService(
			tracing.InitializeTracerForTest(),
			secretStore,
			&kms,
			encryptionService,
			cfg,
			features,
			&usagestats.UsageStatsMock{T: t},
		)
		require.NoError(t, err)

		_, _ = svcDecrypt.Decrypt(context.Background(), encrypted)
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

func TestIntegrationSecretsService_Run(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	ctx := context.Background()
	testDB := db.InitTestDB(t)
	store := database.ProvideSecretsStore(testDB)
	svc := SetupTestService(t, store)

	t.Run("should stop with no error once the context's finished", func(t *testing.T) {
		ctx, cancel := context.WithTimeout(ctx, time.Millisecond)
		defer cancel()

		err := svc.Run(ctx)
		assert.NoError(t, err)
	})

	t.Run("should trigger cache clean up", func(t *testing.T) {
		restoreTimeNowAfterTestExec(t)

		// Encrypt to force data encryption key generation
		encrypted, err := svc.Encrypt(ctx, []byte("grafana"), secrets.WithoutScope())
		require.NoError(t, err)

		// Ten minutes later (after caution period)
		// Look SecretsService.cacheDataKey for more details.
		now = func() time.Time { return time.Now().Add(10 * time.Minute) }

		// Decrypt to ensure data encryption key is cached
		_, err = svc.Decrypt(ctx, encrypted)
		require.NoError(t, err)

		// Data encryption key cache should contain one element
		require.Len(t, svc.dataKeyCache.byId, 1)
		require.Len(t, svc.dataKeyCache.byLabel, 1)

		// Twenty minutes later (after caution period + cache ttl)
		now = func() time.Time { return time.Now().Add(20 * time.Minute) }

		ctx, cancel := context.WithTimeout(ctx, 1*time.Second)
		defer cancel()

		err = svc.Run(ctx)
		require.NoError(t, err)

		// Then, once the ticker has been triggered,
		// the cleanup process should have happened,
		// therefore the cache should be empty.
		require.Len(t, svc.dataKeyCache.byId, 0)
		require.Len(t, svc.dataKeyCache.byLabel, 0)
	})
}

func TestIntegrationSecretsService_ReEncryptDataKeys(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	ctx := context.Background()
	testDB := db.InitTestDB(t)
	store := database.ProvideSecretsStore(testDB)
	svc := SetupTestService(t, store)

	// Encrypt to generate data encryption key
	withoutScope := secrets.WithoutScope()
	ciphertext, err := svc.Encrypt(ctx, []byte("grafana"), withoutScope)
	require.NoError(t, err)

	t.Run("existing key should be re-encrypted", func(t *testing.T) {
		prevDataKeys, err := store.GetAllDataKeys(ctx)
		require.NoError(t, err)
		require.Len(t, prevDataKeys, 1)

		err = svc.ReEncryptDataKeys(ctx)
		require.NoError(t, err)

		reEncryptedDataKeys, err := store.GetAllDataKeys(ctx)
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
		_, err := svc.Decrypt(ctx, ciphertext)
		require.NoError(t, err)
		require.NotEmpty(t, svc.dataKeyCache.byId)
		require.NotEmpty(t, svc.dataKeyCache.byLabel)

		err = svc.ReEncryptDataKeys(ctx)
		require.NoError(t, err)

		assert.Empty(t, svc.dataKeyCache.byId)
		assert.Empty(t, svc.dataKeyCache.byLabel)
	})
}

func TestIntegrationSecretsService_Decrypt(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	ctx := context.Background()
	testDB := db.InitTestDB(t)
	store := database.ProvideSecretsStore(testDB)

	t.Run("empty payload should fail", func(t *testing.T) {
		svc := SetupTestService(t, store)
		_, err := svc.Decrypt(context.Background(), []byte(""))
		require.Error(t, err)

		assert.Equal(t, "unable to decrypt empty payload", err.Error())
	})

	t.Run("ee encrypted payload with ee disabled should fail", func(t *testing.T) {
		svc := SetupTestService(t, store)
		ciphertext, err := svc.Encrypt(ctx, []byte("grafana"), secrets.WithoutScope())
		require.NoError(t, err)

		svc = SetupDisabledTestService(t, store)

		_, err = svc.Decrypt(ctx, ciphertext)
		assert.Error(t, err)
	})

	t.Run("ee encrypted payload with providers initialized should work", func(t *testing.T) {
		svc := SetupTestService(t, store)
		ciphertext, err := svc.Encrypt(ctx, []byte("grafana"), secrets.WithoutScope())
		require.NoError(t, err)

		svc = SetupDisabledTestService(t, store)
		err = svc.InitProviders()
		require.NoError(t, err)

		plaintext, err := svc.Decrypt(ctx, ciphertext)
		assert.NoError(t, err)
		assert.Equal(t, []byte("grafana"), plaintext)
	})

	t.Run("ee encrypted payload with ee enabled should work", func(t *testing.T) {
		svc := SetupTestService(t, store)
		ciphertext, err := svc.Encrypt(ctx, []byte("grafana"), secrets.WithoutScope())
		require.NoError(t, err)

		plaintext, err := svc.Decrypt(ctx, ciphertext)
		assert.NoError(t, err)
		assert.Equal(t, []byte("grafana"), plaintext)
	})

	t.Run("legacy payload should always work", func(t *testing.T) {
		encrypted := []byte{122, 56, 53, 113, 101, 117, 73, 89, 20, 254, 36, 112, 112, 16, 128, 232, 227, 52, 166, 108, 192, 5, 28, 125, 126, 42, 197, 190, 251, 36, 94}

		svc := SetupTestService(t, store)
		decrypted, err := svc.Decrypt(context.Background(), encrypted)
		require.NoError(t, err)
		assert.Equal(t, []byte("grafana"), decrypted)

		svc = SetupDisabledTestService(t, store)
		decrypted, err = svc.Decrypt(context.Background(), encrypted)
		require.NoError(t, err)
		assert.Equal(t, []byte("grafana"), decrypted)
	})
}

func TestIntegration_SecretsService(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx := context.Background()
	someData := []byte(`some-data`)

	tcs := map[string]func(*testing.T, db.DB, *SecretsService){
		"regular": func(t *testing.T, _ db.DB, svc *SecretsService) {
			// We encrypt some data normally, no transactions implied.
			_, err := svc.Encrypt(ctx, someData, secrets.WithoutScope())
			require.NoError(t, err)
		},
		"within successful InTransaction": func(t *testing.T, store db.DB, svc *SecretsService) {
			require.NoError(t, store.InTransaction(ctx, func(ctx context.Context) error {
				// We encrypt some data within a transaction that shares the db session.
				_, err := svc.Encrypt(ctx, someData, secrets.WithoutScope())
				require.NoError(t, err)

				// And the transition succeeds.
				return nil
			}))
		},
		"within unsuccessful InTransaction": func(t *testing.T, store db.DB, svc *SecretsService) {
			require.NotNil(t, store.InTransaction(ctx, func(ctx context.Context) error {
				// We encrypt some data within a transaction that shares the db session.
				_, err := svc.Encrypt(ctx, someData, secrets.WithoutScope())
				require.NoError(t, err)

				// But the transaction fails.
				return errors.New("error")
			}))
		},
		"within unsuccessful InTransaction (plus forced db fetch)": func(t *testing.T, store db.DB, svc *SecretsService) {
			require.NotNil(t, store.InTransaction(ctx, func(ctx context.Context) error {
				// We encrypt some data within a transaction that shares the db session.
				encrypted, err := svc.Encrypt(ctx, someData, secrets.WithoutScope())
				require.NoError(t, err)

				// At this point the data key is not cached yet because
				// the transaction haven't been committed yet,
				// and won't, so we do a decrypt operation within the
				// transaction to force the data key to be
				// (potentially) cached (it shouldn't to prevent issues).
				decrypted, err := svc.Decrypt(ctx, encrypted)
				require.NoError(t, err)
				assert.Equal(t, someData, decrypted)

				// But the transaction fails.
				return errors.New("error")
			}))
		},
		"within successful WithTransactionalDbSession": func(t *testing.T, store db.DB, svc *SecretsService) {
			require.NoError(t, store.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
				// We encrypt some data within a transaction that does not share the db session.
				_, err := svc.Encrypt(ctx, someData, secrets.WithoutScope())
				require.NoError(t, err)

				// And the transition succeeds.
				return nil
			}))
		},
		"within unsuccessful WithTransactionalDbSession": func(t *testing.T, store db.DB, svc *SecretsService) {
			require.NotNil(t, store.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
				// We encrypt some data within a transaction that does not share the db session.
				_, err := svc.Encrypt(ctx, someData, secrets.WithoutScope())
				require.NoError(t, err)

				// But the transaction fails.
				return errors.New("error")
			}))
		},
		"within unsuccessful WithTransactionalDbSession (plus forced db fetch)": func(t *testing.T, store db.DB, svc *SecretsService) {
			require.NotNil(t, store.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
				// We encrypt some data within a transaction that does not share the db session.
				encrypted, err := svc.Encrypt(ctx, someData, secrets.WithoutScope())
				require.NoError(t, err)

				// At this point the data key is not cached yet because
				// the transaction haven't been committed yet,
				// and won't, so we do a decrypt operation within the
				// transaction to force the data key to be
				// (potentially) cached (it shouldn't to prevent issues).
				decrypted, err := svc.Decrypt(ctx, encrypted)
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
			svc := SetupTestService(t, database.ProvideSecretsStore(testDB))

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
			encrypted, err := svc.Encrypt(ctx, toEncrypt, secrets.WithoutScope())
			require.NoError(t, err)

			// We simulate an instance restart. So, there's no data in the in-memory cache.
			svc.dataKeyCache.flush()

			// And then, we MUST still be able to decrypt the previously encrypted data:
			decrypted, err := svc.Decrypt(ctx, encrypted)
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
