package testutils

import (
	"context"
	"testing"

	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	"github.com/madflojo/testcerts"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/utils/ptr"

	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	decryptcontracts "github.com/grafana/grafana/apps/secret/pkg/decrypt"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/decrypt"
	cipher "github.com/grafana/grafana/pkg/registry/apis/secret/encryption/cipher/service"
	osskmsproviders "github.com/grafana/grafana/pkg/registry/apis/secret/encryption/kmsproviders"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption/manager"
	"github.com/grafana/grafana/pkg/registry/apis/secret/mutator"
	"github.com/grafana/grafana/pkg/registry/apis/secret/secretkeeper/sqlkeeper"
	"github.com/grafana/grafana/pkg/registry/apis/secret/service"
	"github.com/grafana/grafana/pkg/registry/apis/secret/validator"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/secret/database"
	encryptionstorage "github.com/grafana/grafana/pkg/storage/secret/encryption"
	"github.com/grafana/grafana/pkg/storage/secret/metadata"
	"github.com/grafana/grafana/pkg/storage/secret/migrator"
)

type SetupConfig struct {
	KeeperService contracts.KeeperService
}

func defaultSetupCfg() SetupConfig {
	return SetupConfig{}
}

func WithKeeperService(keeperService contracts.KeeperService) func(*SetupConfig) {
	return func(setupCfg *SetupConfig) {
		setupCfg.KeeperService = keeperService
	}
}

func WithMutateCfg(f func(*SetupConfig)) func(*SetupConfig) {
	return func(cfg *SetupConfig) {
		f(cfg)
	}
}

func Setup(t *testing.T, opts ...func(*SetupConfig)) Sut {
	setupCfg := defaultSetupCfg()
	for _, opt := range opts {
		opt(&setupCfg)
	}

	tracer := noop.NewTracerProvider().Tracer("test")

	testDB := sqlstore.NewTestStore(t, sqlstore.WithMigrator(migrator.New()))

	database := database.ProvideDatabase(testDB, tracer)

	keeperMetadataStorage, err := metadata.ProvideKeeperMetadataStorage(database, tracer, nil)
	require.NoError(t, err)

	secureValueMetadataStorage, err := metadata.ProvideSecureValueMetadataStorage(database, tracer, nil)
	require.NoError(t, err)

	// Initialize access client + access control
	accessControl := acimpl.ProvideAccessControl(nil)
	accessClient := accesscontrol.NewLegacyAccessClient(accessControl, accesscontrol.ResourceAuthorizerOptions{
		Resource: "securevalues",
		Attr:     "uid",
	})

	defaultKey := "SdlklWklckeLS"
	cfg := setting.NewCfg()
	cfg.SecretsManagement = setting.SecretsManagerSettings{
		CurrentEncryptionProvider: "secret_key.v1",
		ConfiguredKMSProviders:    map[string]map[string]string{"secret_key.v1": {"secret_key": defaultKey}},
	}
	store, err := encryptionstorage.ProvideDataKeyStorage(database, tracer, nil)
	require.NoError(t, err)

	globalDataKeyStore, err := encryptionstorage.ProvideGlobalDataKeyStorage(database, tracer, nil)
	require.NoError(t, err)

	usageStats := &usagestats.UsageStatsMock{T: t}

	enc, err := cipher.ProvideAESGCMCipherService(tracer, usageStats)
	require.NoError(t, err)

	ossProviders, err := osskmsproviders.ProvideOSSKMSProviders(cfg, enc)
	require.NoError(t, err)

	encryptionManager, err := manager.ProvideEncryptionManager(
		tracer,
		store,
		usageStats,
		enc,
		ossProviders,
	)
	require.NoError(t, err)

	// Initialize encrypted value storage with a fake db
	encryptedValueStorage, err := encryptionstorage.ProvideEncryptedValueStorage(database, tracer)
	require.NoError(t, err)

	// Initialize global encrypted value storage with a fake db
	globalEncryptedValueStorage, err := encryptionstorage.ProvideGlobalEncryptedValueStorage(database, tracer)
	require.NoError(t, err)

	sqlKeeper := sqlkeeper.NewSQLKeeper(tracer, encryptionManager, encryptedValueStorage, nil)

	var keeperService contracts.KeeperService = newKeeperServiceWrapper(sqlKeeper)

	if setupCfg.KeeperService != nil {
		keeperService = setupCfg.KeeperService
	}

	secureValueValidator := validator.ProvideSecureValueValidator()
	secureValueMutator := mutator.ProvideSecureValueMutator()

	secureValueService := service.ProvideSecureValueService(tracer, accessClient, database, secureValueMetadataStorage, secureValueValidator, secureValueMutator, keeperMetadataStorage, keeperService, nil)

	decryptAuthorizer := decrypt.ProvideDecryptAuthorizer(tracer)

	decryptStorage, err := metadata.ProvideDecryptStorage(tracer, keeperService, keeperMetadataStorage, secureValueMetadataStorage, decryptAuthorizer, nil)
	require.NoError(t, err)

	testCfg := setting.NewCfg()

	decryptService, err := decrypt.ProvideDecryptService(testCfg, tracer, decryptStorage)
	require.NoError(t, err)

	consolidationService := service.ProvideConsolidationService(tracer, globalDataKeyStore, encryptedValueStorage, globalEncryptedValueStorage, encryptionManager)

	return Sut{
		SecureValueService:          secureValueService,
		SecureValueMetadataStorage:  secureValueMetadataStorage,
		DecryptStorage:              decryptStorage,
		DecryptService:              decryptService,
		EncryptedValueStorage:       encryptedValueStorage,
		GlobalEncryptedValueStorage: globalEncryptedValueStorage,
		SQLKeeper:                   sqlKeeper,
		Database:                    database,
		AccessClient:                accessClient,
		ConsolidationService:        consolidationService,
		EncryptionManager:           encryptionManager,
		GlobalDataKeyStore:          globalDataKeyStore,
	}
}

type Sut struct {
	SecureValueService          contracts.SecureValueService
	SecureValueMetadataStorage  contracts.SecureValueMetadataStorage
	DecryptStorage              contracts.DecryptStorage
	DecryptService              decryptcontracts.DecryptService
	EncryptedValueStorage       contracts.EncryptedValueStorage
	GlobalEncryptedValueStorage contracts.GlobalEncryptedValueStorage
	SQLKeeper                   *sqlkeeper.SQLKeeper
	Database                    *database.Database
	AccessClient                types.AccessClient
	ConsolidationService        contracts.ConsolidationService
	EncryptionManager           contracts.EncryptionManager
	GlobalDataKeyStore          contracts.GlobalDataKeyStorage
}

type CreateSvConfig struct {
	Sv *secretv1beta1.SecureValue
}

func CreateSvWithSv(sv *secretv1beta1.SecureValue) func(*CreateSvConfig) {
	return func(cfg *CreateSvConfig) {
		cfg.Sv = sv
	}
}

func (s *Sut) CreateSv(ctx context.Context, opts ...func(*CreateSvConfig)) (*secretv1beta1.SecureValue, error) {
	cfg := CreateSvConfig{
		Sv: &secretv1beta1.SecureValue{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "sv1",
				Namespace: "ns1",
			},
			Spec: secretv1beta1.SecureValueSpec{
				Description: "desc1",
				Value:       ptr.To(secretv1beta1.NewExposedSecureValue("v1")),
				Decrypters:  []string{"decrypter1"},
			},
			Status: secretv1beta1.SecureValueStatus{},
		},
	}
	for _, opt := range opts {
		opt(&cfg)
	}

	createdSv, err := s.SecureValueService.Create(ctx, cfg.Sv, "actor-uid")
	if err != nil {
		return nil, err
	}
	return createdSv, nil
}

func (s *Sut) UpdateSv(ctx context.Context, sv *secretv1beta1.SecureValue) (*secretv1beta1.SecureValue, error) {
	newSv, _, err := s.SecureValueService.Update(ctx, sv, "actor-uid")
	return newSv, err
}

func (s *Sut) DeleteSv(ctx context.Context, namespace, name string) (*secretv1beta1.SecureValue, error) {
	sv, err := s.SecureValueService.Delete(ctx, xkube.Namespace(namespace), name)
	return sv, err
}

type keeperServiceWrapper struct {
	keeper contracts.Keeper
}

func newKeeperServiceWrapper(keeper contracts.Keeper) *keeperServiceWrapper {
	return &keeperServiceWrapper{keeper: keeper}
}

func (wrapper *keeperServiceWrapper) KeeperForConfig(cfg secretv1beta1.KeeperConfig) (contracts.Keeper, error) {
	return wrapper.keeper, nil
}

func CreateUserAuthContext(ctx context.Context, namespace string, permissions map[string][]string) context.Context {
	orgID := int64(1)
	requester := &identity.StaticRequester{
		Namespace: namespace,
		Type:      types.TypeUser,
		UserID:    1,
		OrgID:     orgID,
		Permissions: map[int64]map[string][]string{
			orgID: permissions,
		},
	}

	return types.WithAuthInfo(ctx, requester)
}

func CreateServiceAuthContext(ctx context.Context, serviceIdentity string, namespace string, permissions []string) context.Context {
	requester := &identity.StaticRequester{
		Namespace: namespace,
		AccessTokenClaims: &authn.Claims[authn.AccessTokenClaims]{
			Rest: authn.AccessTokenClaims{
				Permissions:     permissions,
				ServiceIdentity: serviceIdentity,
			},
		},
	}

	return types.WithAuthInfo(ctx, requester)
}

// CreateOBOAuthContext emulates a context where the request is made on-behalf-of (OBO) a user, with an access token.
func CreateOBOAuthContext(
	ctx context.Context,
	serviceIdentity string,
	namespace string,
	userPermissions map[string][]string,
	delegatedPermissions []string,
) context.Context {
	requester := &identity.StaticRequester{
		Namespace: namespace,
		Type:      types.TypeUser,
		OrgID:     1,
		UserID:    1,
		Permissions: map[int64]map[string][]string{
			1: userPermissions,
		},
		AccessTokenClaims: &authn.Claims[authn.AccessTokenClaims]{
			Rest: authn.AccessTokenClaims{
				ServiceIdentity:      serviceIdentity,
				DelegatedPermissions: delegatedPermissions,
				Actor: &authn.ActorClaims{
					Subject: "user:1",
				},
			},
		},
	}

	return types.WithAuthInfo(ctx, requester)
}

type TestCertPaths struct {
	ClientCert string
	ClientKey  string
	ServerCert string
	ServerKey  string
	CA         string
}

func CreateX509TestDir(t *testing.T) TestCertPaths {
	t.Helper()

	tmpDir := t.TempDir()

	ca := testcerts.NewCA()
	caCertFile, _, err := ca.ToTempFile(tmpDir)
	require.NoError(t, err)

	serverKp, err := ca.NewKeyPair("localhost")
	require.NoError(t, err)

	serverCertFile, serverKeyFile, err := serverKp.ToTempFile(tmpDir)
	require.NoError(t, err)

	clientKp, err := ca.NewKeyPair()
	require.NoError(t, err)
	clientCertFile, clientKeyFile, err := clientKp.ToTempFile(tmpDir)
	require.NoError(t, err)

	return TestCertPaths{
		ClientCert: clientCertFile.Name(),
		ClientKey:  clientKeyFile.Name(),
		ServerCert: serverCertFile.Name(),
		ServerKey:  serverKeyFile.Name(),
		CA:         caCertFile.Name(),
	}
}
