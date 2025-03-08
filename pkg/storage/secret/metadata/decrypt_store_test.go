package metadata

import (
	"context"
	"testing"

	"github.com/go-jose/go-jose/v3/jwt"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"

	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	encryptionmanager "github.com/grafana/grafana/pkg/registry/apis/secret/encryption/manager"
	"github.com/grafana/grafana/pkg/registry/apis/secret/secretkeeper"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	encryptionprovider "github.com/grafana/grafana/pkg/services/encryption/provider"
	encryptionservice "github.com/grafana/grafana/pkg/services/encryption/service"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/kmsproviders/osskmsproviders"
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
	config := `
	[secrets_manager]
	secret_key = sdDkslslld
	encryption_provider = secretKey.v1
	available_encryption_providers = secretKey.v1
	`
	raw, err := ini.Load([]byte(config))
	require.NoError(t, err)

	ctx := types.WithAuthInfo(context.Background(), authn.NewAccessTokenAuthInfo(authn.Claims[authn.AccessTokenClaims]{
		Claims: jwt.Claims{
			Subject: "testuser",
		},
	}))

	// Initialize data key storage and encrypted value storage with a fake db
	testDB := db.InitTestDB(t)
	cfg := &setting.Cfg{Raw: raw}
	features := featuremgmt.WithFeatures(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs, featuremgmt.FlagSecretsManagementAppPlatform)

	dataKeyStore, err := encryptionstorage.ProvideDataKeyStorageStorage(testDB, cfg, features)
	require.NoError(t, err)

	encValueStore, err := encryptionstorage.ProvideEncryptedValueStorage(testDB, cfg, features)
	require.NoError(t, err)

	// Initialize the encryption manager
	encProvider := encryptionprovider.Provider{}
	usageStats := &usagestats.UsageStatsMock{T: t}
	encryption, err := encryptionservice.ProvideEncryptionService(tracing.InitializeTracerForTest(), encProvider, usageStats, cfg)
	require.NoError(t, err)

	encMgr, err := encryptionmanager.NewEncryptionManager(
		tracing.InitializeTracerForTest(),
		dataKeyStore,
		osskmsproviders.ProvideService(encryption, cfg, features),
		encryption,
		cfg,
		usageStats,
	)
	require.NoError(t, err)

	// Initialize the keeper service
	keeperService, err := secretkeeper.ProvideService(tracing.InitializeTracerForTest(), encMgr, encValueStore)
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
