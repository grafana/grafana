package metadata

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/decrypt"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption/cipher"
	encryptionmanager "github.com/grafana/grafana/pkg/registry/apis/secret/encryption/manager"
	"github.com/grafana/grafana/pkg/registry/apis/secret/secretkeeper"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/secret/database"
	encryptionstorage "github.com/grafana/grafana/pkg/storage/secret/encryption"
	"github.com/grafana/grafana/pkg/storage/secret/migrator"
)

func TestIntegrationDecrypt(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	t.Parallel()

	t.Run("when no auth info is present, it returns an error", func(t *testing.T) {
		t.Parallel()

		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)

		decryptSvc, _, _, _ := setupDecryptTestService(t, nil)

		exposed, err := decryptSvc.Decrypt(ctx, "default", "name")
		require.Error(t, err)
		require.Empty(t, exposed)
	})

	t.Run("when secure value cannot be found, it returns an error", func(t *testing.T) {
		t.Parallel()

		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)

		// Create auth context with proper permissions
		authCtx := createAuthContext(ctx, "default", []string{"secret.grafana.app/securevalues/group1:decrypt"}, types.TypeUser)

		decryptSvc, _, _, _ := setupDecryptTestService(t, map[string]struct{}{"group1": {}})

		exposed, err := decryptSvc.Decrypt(authCtx, "default", "non-existent-value")
		require.ErrorIs(t, err, contracts.ErrDecryptNotFound)
		require.Empty(t, exposed)
	})

	t.Run("when auth info is not in allowlist, it returns an unauthorized error", func(t *testing.T) {
		t.Parallel()

		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)

		// Create auth context with permissions that are not in allowlist
		authCtx := createAuthContext(ctx, "default", []string{"secret.grafana.app/securevalues/unlisted-group:decrypt"}, types.TypeUser)

		// Create an allowlist that doesn't include the permission
		allowList := map[string]struct{}{"allowed-group": {}}

		// Setup service
		decryptSvc, secureValueMetadataStorage, keeperService, keeperMetadataService := setupDecryptTestService(t, allowList)

		// Create a secure value that is not in the allowlist
		spec := secretv0alpha1.SecureValueSpec{
			Description: "description",
			Decrypters:  []string{"unlisted-group"},
			Value:       secretv0alpha1.NewExposedSecureValue("value"),
		}
		sv := &secretv0alpha1.SecureValue{Spec: spec}
		sv.Name = "sv-test"
		sv.Namespace = "default"

		newTestSecureValue(authCtx, t, secureValueMetadataStorage, keeperService, keeperMetadataService, sv, "actor-uid")

		exposed, err := decryptSvc.Decrypt(authCtx, "default", "sv-test")
		require.ErrorIs(t, err, contracts.ErrDecryptNotAuthorized)
		require.Empty(t, exposed)
	})

	t.Run("when happy path with valid auth and permissions, it returns decrypted value", func(t *testing.T) {
		t.Parallel()

		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)

		// Create auth context with proper permissions that match the decrypters
		authCtx := createAuthContext(ctx, "default", []string{"secret.grafana.app/securevalues/group1:decrypt"}, types.TypeUser)

		// Include the group in allowlist
		allowList := map[string]struct{}{"group1": {}}

		// Setup service
		decryptSvc, secureValueMetadataStorage, keeperService, keeperMetadataService := setupDecryptTestService(t, allowList)

		// Create a secure value that is in the allowlist
		spec := secretv0alpha1.SecureValueSpec{
			Description: "description",
			Decrypters:  []string{"group1"},
			Value:       secretv0alpha1.NewExposedSecureValue("value"),
		}
		sv := &secretv0alpha1.SecureValue{Spec: spec}
		sv.Name = "sv-test"
		sv.Namespace = "default"

		newTestSecureValue(authCtx, t, secureValueMetadataStorage, keeperService, keeperMetadataService, sv, "actor-uid")

		exposed, err := decryptSvc.Decrypt(authCtx, "default", "sv-test")
		require.NoError(t, err)
		require.NotEmpty(t, exposed)
		require.Equal(t, "value", exposed.DangerouslyExposeAndConsumeValue())
	})

	t.Run("when permission format is malformed (no verb), it returns unauthorized error", func(t *testing.T) {
		t.Parallel()

		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)

		// Create auth context with malformed permission (no verb)
		authCtx := createAuthContext(ctx, "default", []string{"secret.grafana.app/securevalues/group1"}, types.TypeUser)

		// Setup service
		decryptSvc, secureValueMetadataStorage, keeperService, keeperMetadataService := setupDecryptTestService(t, map[string]struct{}{"group1": {}})

		// Create a secure value
		spec := secretv0alpha1.SecureValueSpec{
			Description: "description",
			Decrypters:  []string{"group1"},
			Value:       secretv0alpha1.NewExposedSecureValue("value"),
		}
		sv := &secretv0alpha1.SecureValue{Spec: spec}
		sv.Name = "sv-test"
		sv.Namespace = "default"

		newTestSecureValue(authCtx, t, secureValueMetadataStorage, keeperService, keeperMetadataService, sv, "actor-uid")

		exposed, err := decryptSvc.Decrypt(authCtx, "default", "sv-test")
		require.ErrorIs(t, err, contracts.ErrDecryptNotAuthorized)
		require.Empty(t, exposed)
	})

	t.Run("when permission verb is not 'decrypt', it returns unauthorized error", func(t *testing.T) {
		t.Parallel()

		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)

		// Create auth context with wrong verb
		authCtx := createAuthContext(ctx, "default", []string{"secret.grafana.app/securevalues/group1:read"}, types.TypeUser)

		// Setup service
		decryptSvc, secureValueMetadataStorage, keeperService, keeperMetadataService := setupDecryptTestService(t, map[string]struct{}{"group1": {}})

		// Create a secure value
		spec := secretv0alpha1.SecureValueSpec{
			Description: "description",
			Decrypters:  []string{"group1"},
			Value:       secretv0alpha1.NewExposedSecureValue("value"),
		}
		sv := &secretv0alpha1.SecureValue{Spec: spec}
		sv.Name = "sv-test"
		sv.Namespace = "default"

		newTestSecureValue(authCtx, t, secureValueMetadataStorage, keeperService, keeperMetadataService, sv, "actor-uid")

		exposed, err := decryptSvc.Decrypt(authCtx, "default", "sv-test")
		require.ErrorIs(t, err, contracts.ErrDecryptNotAuthorized)
		require.Empty(t, exposed)
	})

	t.Run("when permission has incorrect number of parts, it returns unauthorized error", func(t *testing.T) {
		t.Parallel()

		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)

		// Create auth context with incorrect number of parts
		authCtx := createAuthContext(ctx, "default", []string{"secret.grafana.app/securevalues:decrypt"}, types.TypeUser)

		// Setup service
		decryptSvc, secureValueMetadataStorage, keeperService, keeperMetadataService := setupDecryptTestService(t, map[string]struct{}{"group1": {}})

		// Create a secure value
		spec := secretv0alpha1.SecureValueSpec{
			Description: "description",
			Decrypters:  []string{"group1"},
			Value:       secretv0alpha1.NewExposedSecureValue("value"),
		}
		sv := &secretv0alpha1.SecureValue{Spec: spec}
		sv.Name = "sv-test"
		sv.Namespace = "default"

		newTestSecureValue(authCtx, t, secureValueMetadataStorage, keeperService, keeperMetadataService, sv, "actor-uid")

		exposed, err := decryptSvc.Decrypt(authCtx, "default", "sv-test")
		require.ErrorIs(t, err, contracts.ErrDecryptNotAuthorized)
		require.Empty(t, exposed)
	})

	t.Run("when permission has incorrect group or resource, it returns unauthorized error", func(t *testing.T) {
		t.Parallel()

		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)

		// Create auth context with incorrect group
		authCtx := createAuthContext(ctx, "default", []string{"wrong.group/securevalues/group1:decrypt"}, types.TypeUser)

		// Setup service
		decryptSvc, secureValueMetadataStorage, keeperService, keeperMetadataService := setupDecryptTestService(t, map[string]struct{}{"group1": {}})

		// Create a secure value
		spec := secretv0alpha1.SecureValueSpec{
			Description: "description",
			Decrypters:  []string{"group1"},
			Value:       secretv0alpha1.NewExposedSecureValue("value"),
		}
		sv := &secretv0alpha1.SecureValue{Spec: spec}
		sv.Name = "sv-test"
		sv.Namespace = "default"

		newTestSecureValue(authCtx, t, secureValueMetadataStorage, keeperService, keeperMetadataService, sv, "actor-uid")

		exposed, err := decryptSvc.Decrypt(authCtx, "default", "sv-test")
		require.Error(t, err)
		require.Equal(t, err.Error(), "not authorized")
		require.Empty(t, exposed)
	})

	// TODO: add more tests for keeper failure scenarios, lets see how the async work will change this though.
}

func setupDecryptTestService(t *testing.T, allowList map[string]struct{}) (*decryptStorage, contracts.SecureValueMetadataStorage, *secretkeeper.OSSKeeperService, contracts.KeeperMetadataStorage) {
	t.Helper()

	// Initialize infra dependencies
	cfg := &setting.Cfg{
		SecretsManagement: setting.SecretsManagerSettings{
			SecretKey:          "sdDkslslld",
			EncryptionProvider: "secretKey.v1",
			Encryption: setting.EncryptionSettings{
				DataKeysCacheTTL:        5 * time.Minute,
				DataKeysCleanupInterval: 1 * time.Nanosecond,
				Algorithm:               cipher.AesGcm,
			},
		},
	}

	features := featuremgmt.WithFeatures(
		featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
		featuremgmt.FlagSecretsManagementAppPlatform,
	)

	db := sqlstore.NewTestStore(t, sqlstore.WithMigrator(migrator.New()))
	database := database.ProvideDatabase(db)

	tracer := tracing.InitializeTracerForTest()

	// Initialize encryption manager and storage
	dataKeyStore, err := encryptionstorage.ProvideDataKeyStorage(db, features)
	require.NoError(t, err)

	encValueStore, err := encryptionstorage.ProvideEncryptedValueStorage(database, features)
	require.NoError(t, err)

	encryptionManager, err := encryptionmanager.ProvideEncryptionManager(
		tracer,
		dataKeyStore,
		cfg,
		&usagestats.UsageStatsMock{},
		encryption.ProviderMap{},
	)
	require.NoError(t, err)

	// Initialize access control and client
	accessControl := acimpl.ProvideAccessControl(features)
	accessClient := accesscontrol.NewLegacyAccessClient(accessControl)

	// Initialize the keeper service
	keeperService, err := secretkeeper.ProvideService(tracer, encValueStore, encryptionManager)
	require.NoError(t, err)

	keeperMetadataStorage, err := ProvideKeeperMetadataStorage(database, features, accessClient)
	require.NoError(t, err)

	// Initialize the secure value storage
	secureValueMetadataStorage, err := ProvideSecureValueMetadataStorage(database, features)
	require.NoError(t, err)

	decryptAuthorizer := decrypt.ProvideDecryptAuthorizer(allowList)

	// Initialize the decrypt storage
	decryptSvc, err := ProvideDecryptStorage(features, keeperService, keeperMetadataStorage, secureValueMetadataStorage, decryptAuthorizer)
	require.NoError(t, err)

	return decryptSvc.(*decryptStorage), secureValueMetadataStorage, keeperService, keeperMetadataStorage
}

func createAuthContext(ctx context.Context, namespace string, permissions []string, identityType types.IdentityType) context.Context {
	requester := &identity.StaticRequester{
		Type:      identityType,
		Namespace: namespace,
		AccessTokenClaims: &authn.Claims[authn.AccessTokenClaims]{
			Rest: authn.AccessTokenClaims{
				Permissions: permissions,
			},
		},
	}

	if identityType == types.TypeUser {
		requester.UserID = 1
	}

	return types.WithAuthInfo(ctx, requester)
}

// This helper will also delete the secureValue from the db when the test is done.
func newTestSecureValue(ctx context.Context, t *testing.T, db contracts.SecureValueMetadataStorage, keeperService *secretkeeper.OSSKeeperService, keeperMetadataStorage contracts.KeeperMetadataStorage, sv *secretv0alpha1.SecureValue, actorUID string) {
	t.Helper()

	_, err := db.Create(ctx, sv, actorUID)
	require.NoError(t, err)

	require.NoError(t, err)

	// Since creating secrets is async, store the secret in the keeper synchronously to make testing easier
	cfg, err := keeperMetadataStorage.GetKeeperConfig(ctx, sv.Namespace, sv.Spec.Keeper)
	require.NoError(t, err)

	keeper, err := keeperService.KeeperForConfig(cfg)
	require.NoError(t, err)

	externalID, err := keeper.Store(ctx, cfg, sv.Namespace, sv.Spec.Value.DangerouslyExposeAndConsumeValue())
	require.NoError(t, err)

	// Set external id for the secure value
	err = db.SetExternalID(ctx, xkube.Namespace(sv.Namespace), sv.Name, externalID)
	require.NoError(t, err)

	t.Cleanup(func() {
		require.NoError(t, keeper.Delete(ctx, cfg, sv.Namespace, externalID))
		require.NoError(t, db.Delete(ctx, xkube.Namespace(sv.Namespace), sv.Name))
	})
}
