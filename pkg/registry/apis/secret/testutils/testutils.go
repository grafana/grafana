package testutils

import (
	"context"
	"testing"
	"time"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	encryptionstorage "github.com/grafana/grafana/pkg/storage/secret/encryption"
	"go.opentelemetry.io/otel/trace/noop"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption/cipher"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption/manager"
	"github.com/grafana/grafana/pkg/registry/apis/secret/reststorage"
	"github.com/grafana/grafana/pkg/registry/apis/secret/secretkeeper/sqlkeeper"
	"github.com/grafana/grafana/pkg/registry/apis/secret/service"
	"github.com/grafana/grafana/pkg/registry/apis/secret/worker"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/secret/database"
	"github.com/grafana/grafana/pkg/storage/secret/metadata"
	"github.com/grafana/grafana/pkg/storage/secret/migrator"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"
)

type setupConfig struct {
	workerCfg     worker.Config
	keeperService contracts.KeeperService
}

func defaultSetupCfg() setupConfig {
	return setupConfig{
		workerCfg: worker.Config{
			BatchSize:                    10,
			ReceiveTimeout:               1 * time.Second,
			PollingInterval:              time.Millisecond,
			MaxMessageProcessingAttempts: 5,
		},
	}
}

func WithWorkerConfig(cfg worker.Config) func(*setupConfig) {
	return func(setupCfg *setupConfig) {
		setupCfg.workerCfg = cfg
	}
}

func WithKeeperService(keeperService contracts.KeeperService) func(*setupConfig) {
	return func(setupCfg *setupConfig) {
		setupCfg.keeperService = keeperService
	}
}

func Setup(t *testing.T, opts ...func(*setupConfig)) Sut {
	setupCfg := defaultSetupCfg()
	for _, opt := range opts {
		opt(&setupCfg)
	}

	tracer := noop.NewTracerProvider().Tracer("test")
	testDB := sqlstore.NewTestStore(t, sqlstore.WithMigrator(migrator.New()))

	database := database.ProvideDatabase(testDB, tracer)

	outboxQueue := metadata.ProvideOutboxQueue(database, tracer)

	features := featuremgmt.WithFeatures(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs, featuremgmt.FlagSecretsManagementAppPlatform)

	keeperMetadataStorage, err := metadata.ProvideKeeperMetadataStorage(database, tracer, features)
	require.NoError(t, err)

	secureValueMetadataStorage, err := metadata.ProvideSecureValueMetadataStorage(database, tracer, features)
	require.NoError(t, err)

	// Initialize access client + access control
	accessControl := &actest.FakeAccessControl{ExpectedEvaluate: true}
	accessClient := accesscontrol.NewLegacyAccessClient(accessControl)

	defaultKey := "SdlklWklckeLS"
	cfg := &setting.Cfg{
		SecretsManagement: setting.SecretsManagerSettings{
			SecretKey:          defaultKey,
			EncryptionProvider: "secretKey.v1",
			Encryption: setting.EncryptionSettings{
				DataKeysCleanupInterval: time.Nanosecond,
				DataKeysCacheTTL:        5 * time.Minute,
				Algorithm:               cipher.AesGcm,
			},
		},
	}
	store, err := encryptionstorage.ProvideDataKeyStorage(database, tracer, features)
	require.NoError(t, err)

	usageStats := &usagestats.UsageStatsMock{T: t}

	encryptionManager, err := manager.ProvideEncryptionManager(
		tracer,
		store,
		cfg,
		usageStats,
		encryption.ProvideThirdPartyProviderMap(),
	)
	require.NoError(t, err)

	// Initialize encrypted value storage with a fake db
	encValueStore, err := encryptionstorage.ProvideEncryptedValueStorage(database, tracer, features)
	require.NoError(t, err)

	sqlKeeper := sqlkeeper.NewSQLKeeper(tracer, encryptionManager, encValueStore)

	var keeperService contracts.KeeperService = newKeeperServiceWrapper(sqlKeeper)

	if setupCfg.keeperService != nil {
		keeperService = setupCfg.keeperService
	}

	secretService := service.ProvideSecureValueService(tracer, accessClient, database, secureValueMetadataStorage, outboxQueue, encryptionManager)

	secureValueRest := reststorage.NewSecureValueRest(tracer, secretService, utils.ResourceInfo{})

	worker, err := worker.NewWorker(
		setupCfg.workerCfg,
		tracer,
		database,
		outboxQueue,
		secureValueMetadataStorage,
		keeperMetadataStorage,
		keeperService,
		encryptionManager,
	)
	require.NoError(t, err)

	return Sut{Worker: worker, SecureValueRest: secureValueRest, SecureValueMetadataStorage: secureValueMetadataStorage, OutboxQueue: outboxQueue, Database: database}
}

type Sut struct {
	Worker                     *worker.Worker
	SecureValueRest            *reststorage.SecureValueRest
	SecureValueMetadataStorage contracts.SecureValueMetadataStorage
	OutboxQueue                contracts.OutboxQueue
	Database                   *database.Database
}

type CreateSvConfig struct {
	Sv *secretv0alpha1.SecureValue
}

func CreateSvWithSv(sv *secretv0alpha1.SecureValue) func(*CreateSvConfig) {
	return func(cfg *CreateSvConfig) {
		cfg.Sv = sv
	}
}

func (s *Sut) CreateSv(opts ...func(*CreateSvConfig)) (*secretv0alpha1.SecureValue, error) {
	cfg := CreateSvConfig{
		Sv: &secretv0alpha1.SecureValue{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "sv1",
				Namespace: "ns1",
			},
			Spec: secretv0alpha1.SecureValueSpec{
				Description: "desc1",
				Value:       secretv0alpha1.NewExposedSecureValue("v1"),
			},
			Status: secretv0alpha1.SecureValueStatus{
				Phase: secretv0alpha1.SecureValuePhasePending,
			},
		},
	}
	for _, opt := range opts {
		opt(&cfg)
	}
	ctx := createAuthContext(context.Background(), "default", []string{"secret.grafana.app/securevalues/group1:decrypt"}, types.TypeUser)

	validationFunc := func(_ context.Context, _ runtime.Object) error { return nil }
	createdSv, err := s.SecureValueRest.Create(ctx, cfg.Sv, validationFunc, &metav1.CreateOptions{})
	if err != nil {
		return nil, err
	}
	return createdSv.(*secretv0alpha1.SecureValue), nil
}

func (s *Sut) UpdateSv(sv *secretv0alpha1.SecureValue) (*secretv0alpha1.SecureValue, error) {
	ctx := createAuthContext(context.Background(), "default", []string{"secret.grafana.app/securevalues/group1:decrypt"}, types.TypeUser)
	ctx = request.WithNamespace(ctx, sv.Namespace)
	validationFunc := func(_ context.Context, _, _ runtime.Object) error { return nil }
	newSv, _, err := s.SecureValueRest.Update(ctx, sv.Name, rest.DefaultUpdatedObjectInfo(sv), nil, validationFunc, false, &metav1.UpdateOptions{})
	if err != nil {
		return nil, err
	}
	return newSv.(*secretv0alpha1.SecureValue), nil
}

func (s *Sut) DeleteSv(namespace, name string) (*secretv0alpha1.SecureValue, error) {
	ctx := context.Background()
	ctx = request.WithNamespace(ctx, namespace)
	validationFunc := func(_ context.Context, _ runtime.Object) error { return nil }
	obj, _, err := s.SecureValueRest.Delete(ctx, name, validationFunc, &metav1.DeleteOptions{})
	if err != nil {
		return nil, err
	}
	return obj.(*secretv0alpha1.SecureValue), nil
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

type keeperServiceWrapper struct {
	keeper contracts.Keeper
}

func newKeeperServiceWrapper(keeper contracts.Keeper) *keeperServiceWrapper {
	return &keeperServiceWrapper{keeper: keeper}
}

func (wrapper *keeperServiceWrapper) KeeperForConfig(cfg secretv0alpha1.KeeperConfig) (contracts.Keeper, error) {
	return wrapper.keeper, nil
}
