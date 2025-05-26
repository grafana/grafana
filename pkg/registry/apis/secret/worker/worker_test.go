package worker

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption/cipher"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption/manager"
	"github.com/grafana/grafana/pkg/registry/apis/secret/reststorage"
	"github.com/grafana/grafana/pkg/registry/apis/secret/secretkeeper/fakes"
	"github.com/grafana/grafana/pkg/registry/apis/secret/service"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/secret/database"
	encryptionstorage "github.com/grafana/grafana/pkg/storage/secret/encryption"
	"github.com/grafana/grafana/pkg/storage/secret/metadata"
	"github.com/grafana/grafana/pkg/storage/secret/migrator"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"
)

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

type fakeKeeperService struct {
	keeperForConfigFunc func(cfg secretv0alpha1.KeeperConfig) (contracts.Keeper, error)
}

func newFakeKeeperService(keeperForConfigFunc func(cfg secretv0alpha1.KeeperConfig) (contracts.Keeper, error)) *fakeKeeperService {
	return &fakeKeeperService{keeperForConfigFunc: keeperForConfigFunc}
}

func (s *fakeKeeperService) KeeperForConfig(cfg secretv0alpha1.KeeperConfig) (contracts.Keeper, error) {
	return s.keeperForConfigFunc(cfg)
}

func TestProcessMessage(t *testing.T) {
	t.Parallel()

	t.Run("secure value metadata status is set to Failed when processing a message fails too many times", func(t *testing.T) {
		t.Parallel()

		// Given a worker that will attempt to process a message N times
		workerCfg := Config{
			BatchSize:                    10,
			ReceiveTimeout:               1 * time.Second,
			PollingInterval:              time.Millisecond,
			MaxMessageProcessingAttempts: 2,
		}

		// And an error that keeps happening
		keeperService := newFakeKeeperService(func(cfg secretv0alpha1.KeeperConfig) (contracts.Keeper, error) {
			return nil, fmt.Errorf("oops")
		})

		sut := setup(t, withWorkerConfig(workerCfg), withKeeperService(keeperService))

		// Queue a create secure value operation
		sv, err := sut.createSv()
		require.NoError(t, err)

		ctx := context.Background()

		for range workerCfg.MaxMessageProcessingAttempts + 1 {
			// The secure value status should be Pending while the worker is trying to process the message
			sv, err = sut.worker.secureValueMetadataStorage.Read(ctx, xkube.Namespace(sv.Namespace), sv.Name, contracts.ReadOpts{})
			require.NoError(t, err)
			require.Equal(t, secretv0alpha1.SecureValuePhasePending, sv.Status.Phase)

			// Worker tries to process messages
			_ = sut.worker.receiveAndProcessMessages(ctx)
		}

		// After the worker fails to process a message too many times,
		// the secure value status is changed to Failed
		sv, err = sut.worker.secureValueMetadataStorage.Read(ctx, xkube.Namespace(sv.Namespace), sv.Name, contracts.ReadOpts{})
		require.NoError(t, err)
		require.Equal(t, secretv0alpha1.SecureValuePhaseFailed, sv.Status.Phase)

		messages, err := sut.outboxQueue.ReceiveN(ctx, 100)
		require.NoError(t, err)
		require.Empty(t, messages)
	})

	t.Run("create sv: secure value metadata status is set to Succeeded when message is processed successfully", func(t *testing.T) {
		t.Parallel()

		sut := setup(t)

		// Queue a create secure value operation
		sv, err := sut.createSv()
		require.NoError(t, err)

		ctx := context.Background()

		// Worker receives and processes the message
		require.NoError(t, sut.worker.receiveAndProcessMessages(ctx))

		// and sets the secure value status to Succeeded
		sv, err = sut.worker.secureValueMetadataStorage.Read(ctx, xkube.Namespace(sv.Namespace), sv.Name, contracts.ReadOpts{})
		require.NoError(t, err)
		require.Equal(t, secretv0alpha1.SecureValuePhaseSucceeded, sv.Status.Phase)

		messages, err := sut.outboxQueue.ReceiveN(ctx, 100)
		require.NoError(t, err)
		require.Empty(t, messages)
	})

	t.Run("update sv: secure value metadata status is set to Succeeded when message is processed successfully", func(t *testing.T) {
		t.Parallel()

		sut := setup(t)

		// Queue a create secure value operation
		sv, err := sut.createSv()
		require.NoError(t, err)

		ctx := context.Background()

		// Worker receives and processes the message
		require.NoError(t, sut.worker.receiveAndProcessMessages(ctx))

		// and sets the secure value status to Succeeded
		sv, err = sut.worker.secureValueMetadataStorage.Read(ctx, xkube.Namespace(sv.Namespace), sv.Name, contracts.ReadOpts{})
		require.NoError(t, err)
		require.Equal(t, secretv0alpha1.SecureValuePhaseSucceeded, sv.Status.Phase)

		sv.Spec.Description = "desc2"
		sv.Spec.Value = secretv0alpha1.NewExposedSecureValue("v2")

		// Queue an update operation
		sv, err = sut.updateSv(sv)
		require.NoError(t, err)
		require.Equal(t, secretv0alpha1.SecureValuePhasePending, sv.Status.Phase)

		// Worker receives and processes the message
		require.NoError(t, sut.worker.receiveAndProcessMessages(ctx))
		updatedSv, err := sut.worker.secureValueMetadataStorage.Read(ctx, xkube.Namespace(sv.Namespace), sv.Name, contracts.ReadOpts{})
		require.NoError(t, err)
		require.Equal(t, secretv0alpha1.SecureValuePhaseSucceeded, updatedSv.Status.Phase)
		require.Equal(t, sv.Spec.Description, updatedSv.Spec.Description)

		messages, err := sut.outboxQueue.ReceiveN(ctx, 100)
		require.NoError(t, err)
		require.Empty(t, messages)
	})

	t.Run("delete sv: secure value metadata is deleted", func(t *testing.T) {
		t.Parallel()

		sut := setup(t)

		// Queue a create secure value operation
		sv, err := sut.createSv()
		require.NoError(t, err)

		ctx := context.Background()

		// Worker receives and processes the message
		require.NoError(t, sut.worker.receiveAndProcessMessages(ctx))

		// and sets the secure value status to Succeeded
		sv, err = sut.worker.secureValueMetadataStorage.Read(ctx, xkube.Namespace(sv.Namespace), sv.Name, contracts.ReadOpts{})
		require.NoError(t, err)
		require.Equal(t, secretv0alpha1.SecureValuePhaseSucceeded, sv.Status.Phase)

		// Queue a delete operation
		updatedSv, err := sut.deleteSv(sv.Namespace, sv.Name)
		require.NoError(t, err)
		require.Equal(t, secretv0alpha1.SecureValuePhasePending, updatedSv.Status.Phase)

		// Worker receives and processes the message
		require.NoError(t, sut.worker.receiveAndProcessMessages(ctx))

		// The secure value has been deleted
		_, err = sut.worker.secureValueMetadataStorage.Read(ctx, xkube.Namespace(sv.Namespace), sv.Name, contracts.ReadOpts{})
		require.ErrorIs(t, err, contracts.ErrSecureValueNotFound)

		messages, err := sut.outboxQueue.ReceiveN(ctx, 100)
		require.NoError(t, err)
		require.Empty(t, messages)
	})

	t.Run("when creating a secure value, the secret is encrypted before it is added to the outbox queue", func(t *testing.T) {
		t.Parallel()

		sut := setup(t)
		ctx := context.Background()

		// Queue a create secure value operation
		var secret string
		_, err := sut.createSv(func(cfg *createSvConfig) {
			secret = string(cfg.sv.Spec.Value)
		})
		require.NoError(t, err)

		messages, err := sut.outboxQueue.ReceiveN(ctx, 100)
		require.NoError(t, err)
		require.Equal(t, 1, len(messages))

		encryptedSecret := messages[0].EncryptedSecret.DangerouslyExposeAndConsumeValue()
		require.NotEmpty(t, secret)
		require.NotEmpty(t, encryptedSecret)
		require.NotEqual(t, secret, encryptedSecret)
	})

	t.Run("when updating a secure value, the secret is encrypted before it is added to the outbox queue", func(t *testing.T) {
		t.Parallel()

		sut := setup(t)
		ctx := context.Background()

		// Queue a create secure value operation
		sv, err := sut.createSv()
		require.NoError(t, err)
		sv.Spec.Value = secretv0alpha1.NewExposedSecureValue("v2")

		sut.worker.receiveAndProcessMessages(ctx)

		newValue := "v2"
		sv.Spec.Value = secretv0alpha1.NewExposedSecureValue(newValue)

		// Queue an update secure value operation
		_, err = sut.updateSv(sv)
		require.NoError(t, err)

		messages, err := sut.outboxQueue.ReceiveN(ctx, 100)
		require.NoError(t, err)
		require.Equal(t, 1, len(messages))

		encryptedSecret := messages[0].EncryptedSecret.DangerouslyExposeAndConsumeValue()
		require.NotEmpty(t, encryptedSecret)
		require.NotEqual(t, newValue, encryptedSecret)
	})

	t.Run("when deleting a secure value, no value is added to the outbox message", func(t *testing.T) {
		t.Parallel()

		sut := setup(t)
		ctx := context.Background()

		// Queue a create secure value operation
		sv, err := sut.createSv()
		require.NoError(t, err)
		sv.Spec.Value = secretv0alpha1.NewExposedSecureValue("v2")

		sut.worker.receiveAndProcessMessages(ctx)

		// Queue a delete secure value operation
		_, err = sut.deleteSv(sv.Namespace, sv.Name)
		require.NoError(t, err)

		messages, err := sut.outboxQueue.ReceiveN(ctx, 100)
		require.NoError(t, err)
		require.Equal(t, 1, len(messages))
		require.Empty(t, messages[0].EncryptedSecret)
	})
}

type setupConfig struct {
	workerCfg     Config
	keeperService contracts.KeeperService
}

func defaultSetupCfg() setupConfig {
	return setupConfig{
		workerCfg: Config{
			BatchSize:                    10,
			ReceiveTimeout:               1 * time.Second,
			PollingInterval:              time.Millisecond,
			MaxMessageProcessingAttempts: 5,
		},
	}
}

func withWorkerConfig(cfg Config) func(*setupConfig) {
	return func(setupCfg *setupConfig) {
		setupCfg.workerCfg = cfg
	}
}

func withKeeperService(keeperService contracts.KeeperService) func(*setupConfig) {
	return func(setupCfg *setupConfig) {
		setupCfg.keeperService = keeperService
	}
}

func setup(t *testing.T, opts ...func(*setupConfig)) sut {
	setupCfg := defaultSetupCfg()
	for _, opt := range opts {
		opt(&setupCfg)
	}

	testDB := sqlstore.NewTestStore(t, sqlstore.WithMigrator(migrator.New()))

	database := database.ProvideDatabase(testDB)

	outboxQueue := metadata.ProvideOutboxQueue(database)

	features := featuremgmt.WithFeatures(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs, featuremgmt.FlagSecretsManagementAppPlatform)

	keeperMetadataStorage, err := metadata.ProvideKeeperMetadataStorage(database, features)
	require.NoError(t, err)

	secureValueMetadataStorage, err := metadata.ProvideSecureValueMetadataStorage(database, features)
	require.NoError(t, err)

	sqlKeeper := fakes.NewFakeKeeper()
	var keeperService contracts.KeeperService = newKeeperServiceWrapper(sqlKeeper)

	if setupCfg.keeperService != nil {
		keeperService = setupCfg.keeperService
	}

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
	store, err := encryptionstorage.ProvideDataKeyStorage(database, features)
	require.NoError(t, err)

	usageStats := &usagestats.UsageStatsMock{T: t}

	encryptionManager, err := manager.ProvideEncryptionManager(
		tracing.InitializeTracerForTest(),
		store,
		cfg,
		usageStats,
		encryption.ProvideThirdPartyProviderMap(),
	)
	require.NoError(t, err)

	secretService := service.ProvideSecretService(accessClient, database, secureValueMetadataStorage, outboxQueue, encryptionManager)

	secureValueRest := reststorage.NewSecureValueRest(secretService, utils.ResourceInfo{})

	worker, err := NewWorker(setupCfg.workerCfg,
		database,
		outboxQueue,
		secureValueMetadataStorage,
		keeperMetadataStorage,
		keeperService,
		encryptionManager,
	)
	require.NoError(t, err)

	return sut{worker: worker, secureValueRest: secureValueRest, outboxQueue: outboxQueue, database: database}
}

type sut struct {
	worker          *Worker
	secureValueRest *reststorage.SecureValueRest
	outboxQueue     contracts.OutboxQueue
	database        *database.Database
}

type createSvConfig struct {
	sv *secretv0alpha1.SecureValue
}

func (s *sut) createSv(opts ...func(*createSvConfig)) (*secretv0alpha1.SecureValue, error) {
	cfg := createSvConfig{
		sv: &secretv0alpha1.SecureValue{
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
	createdSv, err := s.secureValueRest.Create(ctx, cfg.sv, validationFunc, &metav1.CreateOptions{})
	if err != nil {
		return nil, err
	}
	return createdSv.(*secretv0alpha1.SecureValue), nil
}

func (s *sut) updateSv(sv *secretv0alpha1.SecureValue) (*secretv0alpha1.SecureValue, error) {
	ctx := createAuthContext(context.Background(), "default", []string{"secret.grafana.app/securevalues/group1:decrypt"}, types.TypeUser)
	ctx = request.WithNamespace(ctx, sv.Namespace)
	validationFunc := func(_ context.Context, _, _ runtime.Object) error { return nil }
	newSv, _, err := s.secureValueRest.Update(ctx, sv.Name, rest.DefaultUpdatedObjectInfo(sv), nil, validationFunc, false, &metav1.UpdateOptions{})
	if err != nil {
		return nil, err
	}
	return newSv.(*secretv0alpha1.SecureValue), nil
}

func (s *sut) deleteSv(namespace, name string) (*secretv0alpha1.SecureValue, error) {
	ctx := context.Background()
	ctx = request.WithNamespace(ctx, namespace)
	validationFunc := func(_ context.Context, _ runtime.Object) error { return nil }
	obj, _, err := s.secureValueRest.Delete(ctx, name, validationFunc, &metav1.DeleteOptions{})
	if err != nil {
		return nil, err
	}
	return obj.(*secretv0alpha1.SecureValue), nil
}
