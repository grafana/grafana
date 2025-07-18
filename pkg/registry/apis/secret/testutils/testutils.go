package testutils

import (
	"context"
	"testing"

	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/utils/ptr"

	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/decrypt"
	cipher "github.com/grafana/grafana/pkg/registry/apis/secret/encryption/cipher/service"
	osskmsproviders "github.com/grafana/grafana/pkg/registry/apis/secret/encryption/kmsproviders"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption/manager"
	"github.com/grafana/grafana/pkg/registry/apis/secret/secretkeeper/sqlkeeper"
	"github.com/grafana/grafana/pkg/registry/apis/secret/service"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
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
	accessControl := &actest.FakeAccessControl{ExpectedEvaluate: true}
	accessClient := accesscontrol.NewLegacyAccessClient(accessControl, accesscontrol.ResourceAuthorizerOptions{
		Resource: "securevalues",
		Attr:     "uid",
	})

	defaultKey := "SdlklWklckeLS"
	cfg := &setting.Cfg{
		SecretsManagement: setting.SecretsManagerSettings{
			CurrentEncryptionProvider: "secret_key.v1",
			ConfiguredKMSProviders:    map[string]map[string]string{"secret_key.v1": {"secret_key": defaultKey}},
		},
	}
	store, err := encryptionstorage.ProvideDataKeyStorage(database, tracer, nil)
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

	sqlKeeper := sqlkeeper.NewSQLKeeper(tracer, encryptionManager, encryptedValueStorage, nil)

	var keeperService contracts.KeeperService = newKeeperServiceWrapper(sqlKeeper)

	if setupCfg.KeeperService != nil {
		keeperService = setupCfg.KeeperService
	}

	secureValueService := service.ProvideSecureValueService(tracer, accessClient, database, secureValueMetadataStorage, keeperMetadataStorage, keeperService)

	decryptAuthorizer := decrypt.ProvideDecryptAuthorizer(tracer)

	decryptStorage, err := metadata.ProvideDecryptStorage(tracer, keeperService, keeperMetadataStorage, secureValueMetadataStorage, decryptAuthorizer, nil)
	require.NoError(t, err)

	decryptService := decrypt.ProvideDecryptService(decryptStorage)

	return Sut{
		SecureValueService:         secureValueService,
		SecureValueMetadataStorage: secureValueMetadataStorage,
		DecryptStorage:             decryptStorage,
		DecryptService:             decryptService,
		EncryptedValueStorage:      encryptedValueStorage,
		SQLKeeper:                  sqlKeeper,
		Database:                   database,
	}
}

type Sut struct {
	SecureValueService         contracts.SecureValueService
	SecureValueMetadataStorage contracts.SecureValueMetadataStorage
	DecryptStorage             contracts.DecryptStorage
	DecryptService             service.DecryptService
	EncryptedValueStorage      contracts.EncryptedValueStorage
	SQLKeeper                  *sqlkeeper.SQLKeeper
	Database                   *database.Database
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

func CreateServiceAuthContext(ctx context.Context, serviceIdentity string, permissions []string) context.Context {
	requester := &identity.StaticRequester{
		AccessTokenClaims: &authn.Claims[authn.AccessTokenClaims]{
			Rest: authn.AccessTokenClaims{
				Permissions:     permissions,
				ServiceIdentity: serviceIdentity,
			},
		},
	}

	return types.WithAuthInfo(ctx, requester)
}
