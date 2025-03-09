package metadata

import (
	"context"
	"testing"
	"time"

	"github.com/go-jose/go-jose/v3/jwt"
	"github.com/stretchr/testify/require"

	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption"
	encryptionmanager "github.com/grafana/grafana/pkg/registry/apis/secret/encryption/manager"
	"github.com/grafana/grafana/pkg/registry/apis/secret/secretkeeper"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	encryptionstorage "github.com/grafana/grafana/pkg/storage/secret/encryption"
)

func Test_DecryptStore_DecryptFromKeeper(t *testing.T) {
	ctx := types.WithAuthInfo(context.Background(), authn.NewAccessTokenAuthInfo(authn.Claims[authn.AccessTokenClaims]{
		Claims: jwt.Claims{
			Subject: "testuser",
		},
	}))

	s := setupDecryptTestService(t).(*decryptStorage)

	t.Run("decrypt an existent secure value returns no error", func(t *testing.T) {
		exposedValue, err := s.Decrypt(ctx, xkube.Namespace("default"), "sv-test")
		require.NoError(t, err)
		require.NotNil(t, exposedValue)
		require.Equal(t, "value", exposedValue.DangerouslyExposeAndConsumeValue())
	})

	t.Run("decrypt a non existent secure value returns error", func(t *testing.T) {
		exposedValue, err := s.Decrypt(ctx, xkube.Namespace("default"), "non-existent")
		require.Error(t, err)
		require.Equal(t, "[REDACTED]", exposedValue.String())
	})

	t.Run("decrypt a non existent secure value from another namespace returns error", func(t *testing.T) {
		exposedValue, err := s.Decrypt(ctx, xkube.Namespace("another"), "sv-test")
		require.Error(t, err)
		require.Equal(t, "[REDACTED]", exposedValue.String())
	})
}

func setupDecryptTestService(t *testing.T) contracts.DecryptStorage {
	ctx := types.WithAuthInfo(context.Background(), authn.NewAccessTokenAuthInfo(authn.Claims[authn.AccessTokenClaims]{
		Claims: jwt.Claims{
			Subject: "testuser",
		},
	}))

	// Initialize data key storage and encrypted value storage with a fake db
	testDB := db.InitTestDB(t)
	cfg := &setting.Cfg{
		SecretsManagement: setting.SecretsManagerSettings{
			SecretKey:          "sdDkslslld",
			EncryptionProvider: "secretKey.v1",
			Encryption: setting.EncryptionSettings{
				DataKeysCacheTTL:        5 * time.Minute,
				DataKeysCleanupInterval: 1 * time.Nanosecond,
				Algorithm:               "aes-cfb",
			},
		},
	}
	features := featuremgmt.WithFeatures(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs, featuremgmt.FlagSecretsManagementAppPlatform)

	dataKeyStore, err := encryptionstorage.ProvideDataKeyStorageStorage(testDB, cfg, features)
	require.NoError(t, err)

	encValueStore, err := encryptionstorage.ProvideEncryptedValueStorage(testDB, cfg, features)
	require.NoError(t, err)

	// Initialize the encryption manager
	encMgr, err := encryptionmanager.ProvideEncryptionManager(
		tracing.InitializeTracerForTest(),
		dataKeyStore,
		cfg,
		&usagestats.UsageStatsMock{},
		encryption.ProviderMap{},
	)
	require.NoError(t, err)

	// Initialize the keeper service
	keeperService, err := secretkeeper.ProvideService(tracing.InitializeTracerForTest(), encValueStore, encMgr)
	require.NoError(t, err)

	// Initialize access client + access control
	accessControl := &actest.FakeAccessControl{ExpectedEvaluate: true}
	accessClient := accesscontrol.NewLegacyAccessClient(accessControl)

	// Initialize the secure value storage and create a secure value
	svStorage, err := ProvideSecureValueMetadataStorage(testDB, cfg, features, accessClient, keeperService)
	require.NoError(t, err)

	testSV := &secretv0alpha1.SecureValue{
		Spec: secretv0alpha1.SecureValueSpec{
			Title:      "title",
			Value:      "value",
			Keeper:     "kp-default-sql",
			Decrypters: []string{"group1/*", "group2/name"},
		},
	}
	testSV.Namespace = "default"
	testSV.Name = "sv-test"
	_, err = svStorage.Create(ctx, testSV)
	require.NoError(t, err)

	// Initialize the decrypt storage
	decryptStorage, err := ProvideDecryptStorage(testDB, cfg, features, keeperService)
	require.NoError(t, err)

	return decryptStorage
}
