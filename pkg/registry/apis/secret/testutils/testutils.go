package testutils

import (
	"context"
	"testing"
	"time"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	encryptionstorage "github.com/grafana/grafana/pkg/storage/secret/encryption"
	"go.opentelemetry.io/otel/trace/noop"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption/manager"
	"github.com/grafana/grafana/pkg/registry/apis/secret/secretkeeper/sqlkeeper"
	"github.com/grafana/grafana/pkg/registry/apis/secret/service"
	"github.com/grafana/grafana/pkg/registry/apis/secret/worker"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/secret/database"
	"github.com/grafana/grafana/pkg/storage/secret/metadata"
	"github.com/grafana/grafana/pkg/storage/secret/migrator"
	"github.com/stretchr/testify/require"
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

	outboxQueue := metadata.ProvideOutboxQueue(database, tracer, nil)

	features := featuremgmt.WithFeatures(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs, featuremgmt.FlagSecretsManagementAppPlatform)

	keeperMetadataStorage, err := metadata.ProvideKeeperMetadataStorage(database, tracer, features, nil)
	require.NoError(t, err)

	secureValueMetadataStorage, err := metadata.ProvideSecureValueMetadataStorage(database, tracer, features, nil)
	require.NoError(t, err)

	// Initialize access client + access control
	accessControl := &actest.FakeAccessControl{ExpectedEvaluate: true}
	accessClient := accesscontrol.NewLegacyAccessClient(accessControl)

	defaultKey := "SdlklWklckeLS"
	cfg := &setting.Cfg{
		SecretsManagement: setting.SecretsManagerSettings{
			SecretKey:          defaultKey,
			EncryptionProvider: "secretKey.v1",
		},
	}
	store, err := encryptionstorage.ProvideDataKeyStorage(database, tracer, features, nil)
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

	sqlKeeper := sqlkeeper.NewSQLKeeper(tracer, encryptionManager, encValueStore, nil)

	var keeperService contracts.KeeperService = newKeeperServiceWrapper(sqlKeeper)

	if setupCfg.keeperService != nil {
		keeperService = setupCfg.keeperService
	}

	secureValueService := service.ProvideSecureValueService(tracer, accessClient, database, secureValueMetadataStorage, outboxQueue, encryptionManager)

	worker, err := worker.NewWorker(
		setupCfg.workerCfg,
		tracer,
		database,
		outboxQueue,
		secureValueMetadataStorage,
		keeperMetadataStorage,
		keeperService,
		encryptionManager,
		features,
		nil, // metrics
	)
	require.NoError(t, err)

	return Sut{Worker: worker, SecureValueService: secureValueService, SecureValueMetadataStorage: secureValueMetadataStorage, OutboxQueue: outboxQueue, Database: database}
}

type Sut struct {
	Worker                     *worker.Worker
	SecureValueService         *service.SecureValueService
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

func (s *Sut) CreateSv(ctx context.Context, opts ...func(*CreateSvConfig)) (*secretv0alpha1.SecureValue, error) {
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

	createdSv, err := s.SecureValueService.Create(ctx, cfg.Sv, "actor")
	if err != nil {
		return nil, err
	}
	return createdSv, nil
}

func (s *Sut) UpdateSv(ctx context.Context, sv *secretv0alpha1.SecureValue) (*secretv0alpha1.SecureValue, error) {
	newSv, _, err := s.SecureValueService.Update(ctx, sv, "actor")
	return newSv, err
}

func (s *Sut) DeleteSv(ctx context.Context, namespace, name string) (*secretv0alpha1.SecureValue, error) {
	sv, err := s.SecureValueService.Delete(ctx, xkube.Namespace(namespace), name)
	return sv, err
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
