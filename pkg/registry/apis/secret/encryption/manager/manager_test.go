package manager

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"
	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption/cipher/service"
	osskmsproviders "github.com/grafana/grafana/pkg/registry/apis/secret/encryption/kmsproviders"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/secret/database"
	encryptionstorage "github.com/grafana/grafana/pkg/storage/secret/encryption"
	"github.com/grafana/grafana/pkg/storage/secret/migrator"
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

	t.Run("encrypting should create DEK", func(t *testing.T) {
		plaintext := []byte("very secret string")

		encrypted, err := svc.Encrypt(context.Background(), namespace, plaintext)
		require.NoError(t, err)

		decrypted, err := svc.Decrypt(context.Background(), namespace, encrypted)
		require.NoError(t, err)
		assert.Equal(t, plaintext, decrypted)

		keys, err := svc.store.ListDataKeys(ctx, namespace)
		require.NoError(t, err)
		assert.Equal(t, len(keys), 1)
	})

	t.Run("encrypting another secret should use the same DEK", func(t *testing.T) {
		plaintext := []byte("another very secret string")

		encrypted, err := svc.Encrypt(context.Background(), namespace, plaintext)
		require.NoError(t, err)

		decrypted, err := svc.Decrypt(context.Background(), namespace, encrypted)
		require.NoError(t, err)
		assert.Equal(t, plaintext, decrypted)

		keys, err := svc.store.ListDataKeys(ctx, namespace)
		require.NoError(t, err)
		assert.Equal(t, len(keys), 1)
	})

	t.Run("usage stats should be registered", func(t *testing.T) {
		reports, err := svc.usageStats.GetUsageReport(context.Background())
		require.NoError(t, err)

		assert.Equal(t, 1, reports.Metrics["stats.secrets_manager.encryption.current_provider.secret_key.count"])
		assert.Equal(t, 1, reports.Metrics["stats.secrets_manager.encryption.providers.secret_key.count"])
	})
}

func TestEncryptionService_DataKeys(t *testing.T) {
	// Initialize data key storage with a fake db
	testDB := sqlstore.NewTestStore(t, sqlstore.WithMigrator(migrator.New()))
	tracer := noop.NewTracerProvider().Tracer("test")
	store, err := encryptionstorage.ProvideDataKeyStorage(database.ProvideDatabase(testDB, tracer), tracer, nil)
	require.NoError(t, err)

	ctx := context.Background()
	namespace := "test-namespace"

	dataKey := &contracts.SecretDataKey{
		UID:           util.GenerateShortUID(),
		Label:         "test1",
		Active:        true,
		Provider:      "test",
		EncryptedData: []byte{0x62, 0xAF, 0xA1, 0x1A},
		Namespace:     namespace,
	}

	t.Run("querying for a DEK that does not exist", func(t *testing.T) {
		res, err := store.GetDataKey(ctx, namespace, dataKey.UID)
		assert.ErrorIs(t, contracts.ErrDataKeyNotFound, err)
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
		k := &contracts.SecretDataKey{
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
		assert.Equal(t, contracts.ErrDataKeyNotFound, err)
		assert.Nil(t, res)
	})

	t.Run("deleting DEK when no id provided must fail", func(t *testing.T) {
		beforeDelete, err := store.ListDataKeys(ctx, namespace)
		require.NoError(t, err)
		err = store.DeleteDataKey(ctx, namespace, "")
		require.Error(t, err)

		afterDelete, err := store.ListDataKeys(ctx, namespace)
		require.NoError(t, err)
		assert.Equal(t, beforeDelete, afterDelete)
	})

	t.Run("deleting a DEK", func(t *testing.T) {
		err := store.DeleteDataKey(ctx, namespace, dataKey.UID)
		require.NoError(t, err)

		res, err := store.GetDataKey(ctx, namespace, dataKey.UID)
		assert.Equal(t, contracts.ErrDataKeyNotFound, err)
		assert.Nil(t, res)
	})
}

func TestEncryptionService_UseCurrentProvider(t *testing.T) {
	t.Run("When encryption_provider is not specified explicitly, should use 'secretKey' as a current provider", func(t *testing.T) {
		svc := setupTestService(t)
		assert.Equal(t, encryption.ProviderID("secret_key.v1"), svc.providerConfig.CurrentProvider)
	})

	t.Run("Should use encrypt/decrypt methods of the current encryption provider", func(t *testing.T) {
		rawCfg := `
		[secrets_manager.encryption.fakeProvider.v1]
		`

		raw, err := ini.Load([]byte(rawCfg))
		require.NoError(t, err)

		cfg := &setting.Cfg{
			Raw: raw,
			SecretsManagement: setting.SecretsManagerSettings{
				CurrentEncryptionProvider: "secret_key.v1",
				ConfiguredKMSProviders:    map[string]map[string]string{"secret_key.v1": {"secret_key": "SW2YcwTIb9zpOOhoPsMm"}},
			},
		}

		testDB := sqlstore.NewTestStore(t, sqlstore.WithMigrator(migrator.New()))
		tracer := noop.NewTracerProvider().Tracer("test")
		encryptionStore, err := encryptionstorage.ProvideDataKeyStorage(database.ProvideDatabase(testDB, tracer), tracer, nil)
		require.NoError(t, err)

		usageStats := &usagestats.UsageStatsMock{T: t}
		enc, err := service.ProvideAESGCMCipherService(tracer, usageStats)
		require.NoError(t, err)

		ossProviders, err := osskmsproviders.ProvideOSSKMSProviders(cfg, enc)
		require.NoError(t, err)

		encMgr, err := ProvideEncryptionManager(
			tracer,
			encryptionStore,
			usageStats,
			enc,
			ossProviders,
		)
		require.NoError(t, err)

		encryptionManager := encMgr.(*EncryptionManager)

		//override default provider with fake, and register the fake separately
		fake := &fakeProvider{}
		encryptionManager.providerConfig.AvailableProviders = encryption.ProviderMap{
			encryption.ProviderID("fakeProvider.v1"): fake,
		}
		encryptionManager.providerConfig.CurrentProvider = encryption.ProviderID("fakeProvider.v1")

		namespace := "test-namespace"
		encrypted, _ := encryptionManager.Encrypt(context.Background(), namespace, []byte{})
		assert.True(t, fake.encryptCalled)
		assert.False(t, fake.decryptCalled)

		// encryption manager tries to find a DEK in a cache first before calling provider's decrypt
		// to bypass the cache, we set up one more secrets service to test decrypting
		svcDecryptMgr, err := ProvideEncryptionManager(
			tracer,
			encryptionStore,
			usageStats,
			enc,
			ossProviders,
		)
		require.NoError(t, err)

		svcDecrypt := svcDecryptMgr.(*EncryptionManager)
		svcDecrypt.providerConfig.AvailableProviders = encryption.ProviderMap{
			encryption.ProviderID("fakeProvider.v1"): fake,
		}
		svcDecrypt.providerConfig.CurrentProvider = encryption.ProviderID("fakeProvider.v1")

		_, _ = svcDecrypt.Decrypt(context.Background(), namespace, encrypted)
		assert.True(t, fake.decryptCalled, "fake provider's decrypt should be called")
	})
}

func TestEncryptionService_SecretKeyVersionUpgrade(t *testing.T) {
	ctx := context.Background()
	namespace := "test-namespace"

	// Generate random keys for testing
	oldKey := util.GenerateShortUID() + util.GenerateShortUID() // 32 chars
	newKey := util.GenerateShortUID() + util.GenerateShortUID() // 32 chars

	t.Run("should encrypt with v1, upgrade to v2, encrypt with v2, and decrypt both", func(t *testing.T) {
		// Step 1: Set up v1 configuration
		cfgV1 := &setting.Cfg{
			SecretsManagement: setting.SecretsManagerSettings{
				CurrentEncryptionProvider: "secret_key.v1",
				ConfiguredKMSProviders:    map[string]map[string]string{"secret_key.v1": {"secret_key": oldKey}},
			},
		}

		testDB := sqlstore.NewTestStore(t, sqlstore.WithMigrator(migrator.New()))
		tracer := noop.NewTracerProvider().Tracer("test")
		encryptionStore, err := encryptionstorage.ProvideDataKeyStorage(database.ProvideDatabase(testDB, tracer), tracer, nil)
		require.NoError(t, err)

		usageStats := &usagestats.UsageStatsMock{T: t}
		enc, err := service.ProvideAESGCMCipherService(tracer, usageStats)
		require.NoError(t, err)

		ossProviders, err := osskmsproviders.ProvideOSSKMSProviders(cfgV1, enc)
		require.NoError(t, err)

		svcV1, err := ProvideEncryptionManager(
			tracer,
			encryptionStore,
			usageStats,
			enc,
			ossProviders,
		)
		require.NoError(t, err)

		// Step 2: Encrypt something with v1
		plaintext := []byte("secret data from v1")
		encryptedV1, err := svcV1.Encrypt(ctx, namespace, plaintext)
		require.NoError(t, err)

		// Verify v1 can decrypt its own data
		decryptedV1, err := svcV1.Decrypt(ctx, namespace, encryptedV1)
		require.NoError(t, err)
		assert.Equal(t, plaintext, decryptedV1)

		// Verify current provider is v1
		encMgrV1 := svcV1.(*EncryptionManager)
		assert.Equal(t, encryption.ProviderID("secret_key.v1"), encMgrV1.providerConfig.CurrentProvider)

		// Step 3: Create new configuration with v2 as current provider
		cfgV2 := &setting.Cfg{
			SecretsManagement: setting.SecretsManagerSettings{
				CurrentEncryptionProvider: "secret_key.v2",
				ConfiguredKMSProviders: map[string]map[string]string{
					"secret_key.v1": {"secret_key": oldKey},
					"secret_key.v2": {"secret_key": newKey},
				},
			},
		}

		// Reinitialize service with v2 configuration (reuse same store)
		ossProvidersV2, err := osskmsproviders.ProvideOSSKMSProviders(cfgV2, enc)
		require.NoError(t, err)

		svcV2, err := ProvideEncryptionManager(
			tracer,
			encryptionStore,
			usageStats,
			enc,
			ossProvidersV2,
		)
		require.NoError(t, err)

		// Step 4: Ensure we can encrypt and decrypt with the new key (v2)
		newPlaintext := []byte("secret data from v2")
		encryptedV2, err := svcV2.Encrypt(ctx, namespace, newPlaintext)
		require.NoError(t, err)

		decryptedV2, err := svcV2.Decrypt(ctx, namespace, encryptedV2)
		require.NoError(t, err)
		assert.Equal(t, newPlaintext, decryptedV2)

		// Verify current provider is v2
		encMgrV2 := svcV2.(*EncryptionManager)
		assert.Equal(t, encryption.ProviderID("secret_key.v2"), encMgrV2.providerConfig.CurrentProvider)

		// Step 5: Ensure we can decrypt the old value encrypted with v1
		decryptedOldWithV2, err := svcV2.Decrypt(ctx, namespace, encryptedV1)
		require.NoError(t, err)
		assert.Equal(t, plaintext, decryptedOldWithV2)

		// Verify both providers are available
		assert.Contains(t, encMgrV2.providerConfig.AvailableProviders, encryption.ProviderID("secret_key.v1"))
		assert.Contains(t, encMgrV2.providerConfig.AvailableProviders, encryption.ProviderID("secret_key.v2"))
		assert.Equal(t, 2, len(encMgrV2.providerConfig.AvailableProviders))
	})

	t.Run("encrypting with v1 then removing the v1 config should cause decryption to fail", func(t *testing.T) {
		tracer := noop.NewTracerProvider().Tracer("test")
		testDB := sqlstore.NewTestStore(t, sqlstore.WithMigrator(migrator.New()))
		encryptionStore, err := encryptionstorage.ProvideDataKeyStorage(database.ProvideDatabase(testDB, tracer), tracer, nil)
		require.NoError(t, err)

		usageStats := &usagestats.UsageStatsMock{T: t}
		enc, err := service.ProvideAESGCMCipherService(tracer, usageStats)
		require.NoError(t, err)

		cfgV1 := &setting.Cfg{
			SecretsManagement: setting.SecretsManagerSettings{
				CurrentEncryptionProvider: "secret_key.v1",
				ConfiguredKMSProviders: map[string]map[string]string{
					"secret_key.v1": {"secret_key": uuid.New().String()},
				},
			},
		}

		ossProviders, err := osskmsproviders.ProvideOSSKMSProviders(cfgV1, enc)
		require.NoError(t, err)

		svcV1, err := ProvideEncryptionManager(
			tracer,
			encryptionStore,
			usageStats,
			enc,
			ossProviders,
		)
		require.NoError(t, err)

		rsp, err := svcV1.Encrypt(ctx, namespace, []byte("test"))
		require.NoError(t, err)

		cfgV2 := &setting.Cfg{
			SecretsManagement: setting.SecretsManagerSettings{
				CurrentEncryptionProvider: "secret_key.v2",
				ConfiguredKMSProviders: map[string]map[string]string{
					"secret_key.v2": {"secret_key": uuid.New().String()},
				},
			},
		}

		ossProvidersV2, err := osskmsproviders.ProvideOSSKMSProviders(cfgV2, enc)
		require.NoError(t, err)

		svcV2, err := ProvideEncryptionManager(
			tracer,
			encryptionStore,
			usageStats,
			enc,
			ossProvidersV2,
		)
		require.NoError(t, err)

		_, err = svcV2.Decrypt(ctx, namespace, rsp)
		require.Error(t, err)
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
		ciphertext, err := svc.Encrypt(ctx, namespace, []byte("grafana"))
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

	tcs := map[string]func(*testing.T, db.DB, contracts.EncryptionManager){
		"regular": func(t *testing.T, _ db.DB, svc contracts.EncryptionManager) {
			// We encrypt some data normally, no transactions implied.
			_, err := svc.Encrypt(ctx, namespace, someData)
			require.NoError(t, err)
		},
		"within successful InTransaction": func(t *testing.T, store db.DB, svc contracts.EncryptionManager) {
			require.NoError(t, store.InTransaction(ctx, func(ctx context.Context) error {
				// We encrypt some data within a transaction that shares the db session.
				_, err := svc.Encrypt(ctx, namespace, someData)
				require.NoError(t, err)

				// And the transition succeeds.
				return nil
			}))
		},
		"within unsuccessful InTransaction": func(t *testing.T, store db.DB, svc contracts.EncryptionManager) {
			require.NotNil(t, store.InTransaction(ctx, func(ctx context.Context) error {
				// We encrypt some data within a transaction that shares the db session.
				_, err := svc.Encrypt(ctx, namespace, someData)
				require.NoError(t, err)

				// But the transaction fails.
				return errors.New("error")
			}))
		},
		"within unsuccessful InTransaction (plus forced db fetch)": func(t *testing.T, store db.DB, svc contracts.EncryptionManager) {
			require.NotNil(t, store.InTransaction(ctx, func(ctx context.Context) error {
				// We encrypt some data within a transaction that shares the db session.
				encrypted, err := svc.Encrypt(ctx, namespace, someData)
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
		"within successful WithTransactionalDbSession": func(t *testing.T, store db.DB, svc contracts.EncryptionManager) {
			require.NoError(t, store.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
				// We encrypt some data within a transaction that does not share the db session.
				_, err := svc.Encrypt(ctx, namespace, someData)
				require.NoError(t, err)

				// And the transition succeeds.
				return nil
			}))
		},
		"within unsuccessful WithTransactionalDbSession": func(t *testing.T, store db.DB, svc contracts.EncryptionManager) {
			require.NotNil(t, store.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
				// We encrypt some data within a transaction that does not share the db session.
				_, err := svc.Encrypt(ctx, namespace, someData)
				require.NoError(t, err)

				// But the transaction fails.
				return errors.New("error")
			}))
		},
		"within unsuccessful WithTransactionalDbSession (plus forced db fetch)": func(t *testing.T, store db.DB, svc contracts.EncryptionManager) {
			require.NotNil(t, store.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
				// We encrypt some data within a transaction that does not share the db session.
				encrypted, err := svc.Encrypt(ctx, namespace, someData)
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
			testDB := sqlstore.NewTestStore(t, sqlstore.WithMigrator(migrator.New()))
			tracer := noop.NewTracerProvider().Tracer("test")

			cfg := &setting.Cfg{
				SecretsManagement: setting.SecretsManagerSettings{
					CurrentEncryptionProvider: "secret_key.v1",
					ConfiguredKMSProviders:    map[string]map[string]string{"secret_key.v1": {"secret_key": "SW2YcwTIb9zpOOhoPsMm"}},
				},
			}
			store, err := encryptionstorage.ProvideDataKeyStorage(database.ProvideDatabase(testDB, tracer), tracer, nil)
			require.NoError(t, err)

			usageStats := &usagestats.UsageStatsMock{T: t}

			enc, err := service.ProvideAESGCMCipherService(tracer, usageStats)
			require.NoError(t, err)

			ossProviders, err := osskmsproviders.ProvideOSSKMSProviders(cfg, enc)
			require.NoError(t, err)

			svc, err := ProvideEncryptionManager(
				tracer,
				store,
				usageStats,
				enc,
				ossProviders,
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
			encrypted, err := svc.Encrypt(ctx, namespace, toEncrypt)
			require.NoError(t, err)

			// And then, we MUST still be able to decrypt the previously encrypted data:
			decrypted, err := svc.Decrypt(ctx, namespace, encrypted)
			require.NoError(t, err)
			assert.Equal(t, toEncrypt, decrypted)
		})
	}
}

func TestEncryptionService_ThirdPartyProviders(t *testing.T) {
	tracer := noop.NewTracerProvider().Tracer("test")
	usageStats := &usagestats.UsageStatsMock{T: t}

	enc, err := service.ProvideAESGCMCipherService(tracer, usageStats)
	require.NoError(t, err)

	svc, err := ProvideEncryptionManager(
		tracer,
		nil,
		usageStats,
		enc,
		encryption.ProviderConfig{
			CurrentProvider: encryption.ProviderID("fakeProvider.v1"),
			AvailableProviders: encryption.ProviderMap{
				encryption.ProviderID("fakeProvider.v1"): &fakeProvider{},
			},
		},
	)
	require.NoError(t, err)

	encMgr := svc.(*EncryptionManager)
	require.Len(t, encMgr.providerConfig.AvailableProviders, 1)
	require.Contains(t, encMgr.providerConfig.AvailableProviders, encryption.ProviderID("fakeProvider.v1"))
}
