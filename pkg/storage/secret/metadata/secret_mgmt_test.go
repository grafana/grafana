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
	"github.com/grafana/grafana/pkg/tests/testsuite"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func Test_SecretMgmt_StoreInKeeper(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)

	testSV := &secretv0alpha1.SecureValue{
		ObjectMeta: metav1.ObjectMeta{
			Namespace: "default",
		},
		Spec: secretv0alpha1.SecureValueSpec{
			Title:      "title",
			Value:      "value",
			Keeper:     "kp-default-sql",
			Decrypters: []string{"group1/*", "group2/name"},
		},
	}
	s := setupTestService(t).(*secureValueMetadataStorage)

	t.Run("store secure value in default sql keeper does not return error", func(t *testing.T) {
		externalID, err := s.storeInKeeper(ctx, testSV)
		require.NoError(t, err)
		require.NotEmpty(t, externalID)
	})

	t.Run("store secure value in a non implemented keeper returns error", func(t *testing.T) {
		testSV.Spec.Keeper = "not-implemented-keeper"
		externalID, err := s.storeInKeeper(ctx, testSV)
		require.Error(t, err)
		require.Empty(t, externalID)
	})

	t.Run("store secure value in a not implemented keeper returns error", func(t *testing.T) {
		testSV.Spec.Keeper = "not-implemented-keeper"
		externalID, err := s.storeInKeeper(ctx, testSV)
		require.Error(t, err)
		require.Empty(t, externalID)
	})
}

func Test_SecretMgmt_UpdateInKeeper(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)

	testSV := &secretv0alpha1.SecureValue{
		ObjectMeta: metav1.ObjectMeta{
			Namespace: "default",
		},
		Spec: secretv0alpha1.SecureValueSpec{
			Title:      "title",
			Value:      "value",
			Keeper:     "kp-default-sql",
			Decrypters: []string{"group1/*", "group2/name"},
		},
	}
	testsvDB := &secureValueDB{
		Namespace: "default",
		Name:      "name",
		Keeper:    "kp-default-sql",
	}
	s := setupTestService(t).(*secureValueMetadataStorage)

	t.Run("store secure value in default sql keeper does not return error", func(t *testing.T) {
		externalID, err := s.storeInKeeper(ctx, testSV)
		require.NoError(t, err)
		require.NotEmpty(t, externalID)
		testsvDB.ExternalID = string(externalID)

		t.Run("updating a secure value returns no error", func(t *testing.T) {
			err := s.updateInKeeper(ctx, testsvDB, testSV)
			require.NoError(t, err)
		})

		t.Run("updating a secure value keeper returns error", func(t *testing.T) {
			updateSV := testSV.DeepCopy()
			updateSV.Spec.Keeper = "another-keeper"
			err := s.updateInKeeper(ctx, testsvDB, updateSV)
			require.Error(t, err)
		})

		t.Run("not updating the value of a secure value value returns no error", func(t *testing.T) {
			updateSV := testSV.DeepCopy()
			updateSV.Spec.Value = ""
			err := s.updateInKeeper(ctx, testsvDB, updateSV)
			require.NoError(t, err)
		})
	})

	t.Run("updating a non existent secure value returns no error", func(t *testing.T) {
		err := s.updateInKeeper(ctx, testsvDB, testSV)
		require.NoError(t, err)
	})
}

func Test_SecretMgmt_DeleteInKeeper(t *testing.T) {
	ctx := types.WithAuthInfo(context.Background(), authn.NewAccessTokenAuthInfo(authn.Claims[authn.AccessTokenClaims]{
		Claims: jwt.Claims{
			Subject: "testuser",
		},
	}))

	testSV := &secretv0alpha1.SecureValue{
		ObjectMeta: metav1.ObjectMeta{
			Namespace: "default",
		},
		Spec: secretv0alpha1.SecureValueSpec{
			Title:      "title",
			Value:      "value",
			Keeper:     "kp-default-sql",
			Decrypters: []string{"group1/*", "group2/name"},
		},
	}
	s := setupTestService(t).(*secureValueMetadataStorage)

	t.Run("create secure value in default sql keeper does not return error", func(t *testing.T) {
		sv, err := s.Create(ctx, testSV)
		require.NoError(t, err)
		require.NotEmpty(t, sv)

		t.Run("delete the secure value returns no error", func(t *testing.T) {
			err := s.deleteFromKeeper(ctx, xkube.Namespace(sv.GetNamespace()), sv.GetName())
			require.NoError(t, err)
		})
	})

	t.Run("delete a non exitent secure value returns error", func(t *testing.T) {
		err := s.deleteFromKeeper(ctx, "default", "non-existent")
		require.Error(t, err)
	})
}

func Test_SecretMgmt_GetKeeperConfig(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	s := setupTestService(t).(*secureValueMetadataStorage)

	t.Run("get default sql keeper config", func(t *testing.T) {
		keeperType, keeperConfig, err := getKeeperConfig(ctx, s.db, "default", "kp-default-sql")
		require.NoError(t, err)
		require.Equal(t, contracts.SQLKeeperType, keeperType)
		require.Nil(t, keeperConfig)
	})

	t.Run("get test keeper config", func(t *testing.T) {
		keeperType, keeperConfig, err := getKeeperConfig(ctx, s.db, "default", "kp-test")
		require.NoError(t, err)
		require.Equal(t, contracts.SQLKeeperType, keeperType)
		require.NotNil(t, keeperConfig)
	})
}

func setupTestService(t *testing.T) contracts.SecureValueMetadataStorage {
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
	cfg := &setting.Cfg{
		SecretsManagement: setting.SecretsManagerSettings{
			SecretKey:          "sdDkslslld",
			EncryptionProvider: "secretKey.v1",
			AvailableProviders: []string{"secretKey.v1"},
		},
		// TODO: remove this once we no longer have the dependency on legacy envelope encryption
		Raw: raw,
	}

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

	// Initialize the keeper storage and add a test keeper
	keeperStorage, err := ProvideKeeperMetadataStorage(testDB, cfg, features, accessClient)
	require.NoError(t, err)
	testKeeper := &secretv0alpha1.Keeper{
		Spec: secretv0alpha1.KeeperSpec{
			Title: "title",
			SQL:   &secretv0alpha1.SQLKeeperConfig{Encryption: &secretv0alpha1.Encryption{}},
		},
	}
	testKeeper.Name = "kp-test"
	testKeeper.Namespace = "default"
	_, err = keeperStorage.Create(ctx, testKeeper)
	require.NoError(t, err)

	// Initialize the secure value storage
	secureValueMetadataStorage, err := ProvideSecureValueMetadataStorage(testDB, cfg, features, accessClient, keeperService)
	require.NoError(t, err)

	return secureValueMetadataStorage
}
