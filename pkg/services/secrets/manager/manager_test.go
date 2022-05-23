package manager

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/services/encryption/ossencryption"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/kmsproviders/osskmsproviders"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/secrets/database"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
)

func TestSecretsService_EnvelopeEncryption(t *testing.T) {
	store := database.ProvideSecretsStore(sqlstore.InitTestDB(t))
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

	t.Run("decrypting empty payload should return error", func(t *testing.T) {
		_, err := svc.Decrypt(context.Background(), []byte(""))
		require.Error(t, err)

		assert.Equal(t, "unable to decrypt empty payload", err.Error())
	})

	t.Run("decrypting legacy secret encrypted with secret key from settings", func(t *testing.T) {
		expected := "grafana"
		encrypted := []byte{122, 56, 53, 113, 101, 117, 73, 89, 20, 254, 36, 112, 112, 16, 128, 232, 227, 52, 166, 108, 192, 5, 28, 125, 126, 42, 197, 190, 251, 36, 94}
		decrypted, err := svc.Decrypt(context.Background(), encrypted)
		require.NoError(t, err)
		assert.Equal(t, expected, string(decrypted))
	})

	t.Run("usage stats should be registered", func(t *testing.T) {
		reports, err := svc.usageStats.GetUsageReport(context.Background())
		require.NoError(t, err)

		assert.Equal(t, 1, reports.Metrics["stats.encryption.envelope_encryption_enabled.count"])
		assert.Equal(t, 1, reports.Metrics["stats.encryption.current_provider.secretKey.count"])
		assert.Equal(t, 1, reports.Metrics["stats.encryption.providers.secretKey.count"])
	})
}

func TestSecretsService_DataKeys(t *testing.T) {
	store := database.ProvideSecretsStore(sqlstore.InitTestDB(t))
	ctx := context.Background()

	dataKey := &secrets.DataKey{
		Id:            util.GenerateShortUID(),
		Active:        true,
		Name:          "test1",
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
		assert.Equal(t, dataKey.Name, res.Name)
		assert.Equal(t, dataKey.Id, res.Id)
		assert.True(t, dataKey.Active)

		current, err := store.GetCurrentDataKey(ctx, dataKey.Name)
		require.NoError(t, err)
		assert.Equal(t, dataKey.EncryptedData, current.EncryptedData)
		assert.Equal(t, dataKey.Provider, current.Provider)
		assert.Equal(t, dataKey.Name, current.Name)
		assert.Equal(t, dataKey.Id, current.Id)
		assert.True(t, current.Active)
	})

	t.Run("creating an inactive DEK", func(t *testing.T) {
		k := &secrets.DataKey{
			Id:            util.GenerateShortUID(),
			Active:        false,
			Name:          "test2",
			Provider:      "test",
			EncryptedData: []byte{0x62, 0xAF, 0xA1, 0x1A},
		}

		err := store.CreateDataKey(ctx, k)
		require.Error(t, err)

		res, err := store.GetDataKey(ctx, k.Name)
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

func TestSecretsService_UseCurrentProvider(t *testing.T) {
	t.Run("When encryption_provider is not specified explicitly, should use 'secretKey' as a current provider", func(t *testing.T) {
		svc := SetupTestService(t, database.ProvideSecretsStore(sqlstore.InitTestDB(t)))
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

		encryptionService := ossencryption.ProvideService()
		settings := &setting.OSSImpl{Cfg: &setting.Cfg{Raw: raw}}
		features := featuremgmt.WithFeatures()
		kms := newFakeKMS(osskmsproviders.ProvideService(encryptionService, settings, features))
		secretStore := database.ProvideSecretsStore(sqlstore.InitTestDB(t))

		secretsService, err := ProvideSecretsService(
			secretStore,
			&kms,
			encryptionService,
			settings,
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
			secretStore,
			&kms,
			encryptionService,
			settings,
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

func TestSecretsService_Run(t *testing.T) {
	ctx := context.Background()
	sql := sqlstore.InitTestDB(t)
	store := database.ProvideSecretsStore(sql)
	svc := SetupTestService(t, store)

	t.Run("should stop with no error once the context's finished", func(t *testing.T) {
		ctx, cancel := context.WithTimeout(ctx, time.Millisecond)
		defer cancel()

		err := svc.Run(ctx)
		assert.NoError(t, err)
	})

	t.Run("should trigger cache clean up", func(t *testing.T) {
		// Encrypt to ensure there's a data encryption key generated
		_, err := svc.Encrypt(ctx, []byte("grafana"), secrets.WithoutScope())
		require.NoError(t, err)

		// Data encryption key cache should contain one element
		require.Len(t, svc.dataKeyCache.byId, 1)
		require.Len(t, svc.dataKeyCache.byName, 1)

		t.Cleanup(func() { now = time.Now })
		now = func() time.Time { return time.Now().Add(10 * time.Minute) }

		ctx, cancel := context.WithTimeout(ctx, 1*time.Second)
		defer cancel()

		err = svc.Run(ctx)
		require.NoError(t, err)

		// Then, once the ticker has been triggered,
		// the cleanup process should have happened,
		// therefore the cache should be empty.
		require.Len(t, svc.dataKeyCache.byId, 0)
		require.Len(t, svc.dataKeyCache.byName, 0)
	})
}

func TestSecretsService_ReEncryptDataKeys(t *testing.T) {
	ctx := context.Background()
	sql := sqlstore.InitTestDB(t)
	store := database.ProvideSecretsStore(sql)
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
		// Decrypt to ensure data key is cached
		_, err := svc.Decrypt(ctx, ciphertext)
		require.NoError(t, err)
		require.NotEmpty(t, svc.dataKeyCache.byId)
		require.NotEmpty(t, svc.dataKeyCache.byName)

		err = svc.ReEncryptDataKeys(ctx)
		require.NoError(t, err)

		assert.Empty(t, svc.dataKeyCache.byId)
		assert.Empty(t, svc.dataKeyCache.byName)
	})
}
