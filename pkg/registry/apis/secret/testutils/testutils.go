package testutils

import (
	"context"
	"fmt"
	"testing"
	"time"

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
	"github.com/grafana/grafana/pkg/registry/apis/secret/garbagecollectionworker"
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
	KeeperService            contracts.KeeperService
	DataKeyMigrationExecutor contracts.EncryptedValueMigrationExecutor
	RunSecretsDBMigrations   bool
	RunDataKeyMigration      bool
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

	clock := NewFakeClock()

	secureValueMetadataStorage, err := metadata.ProvideSecureValueMetadataStorage(clock, database, tracer, nil)
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
		CurrentEncryptionProvider:     "secret_key.v1",
		ConfiguredKMSProviders:        map[string]map[string]string{"secret_key.v1": {"secret_key": defaultKey}},
		GCWorkerEnabled:               false,
		RunSecretsDBMigrations:        setupCfg.RunSecretsDBMigrations,
		RunDataKeyMigration:           setupCfg.RunDataKeyMigration,
		GCWorkerMaxBatchSize:          2,
		GCWorkerMaxConcurrentCleanups: 2,
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

	// Initialize a noop migration executor for the sql keeper so it doesn't interfere with initialization, or use the one provided
	fakeMigrationExecutor := setupCfg.DataKeyMigrationExecutor
	if fakeMigrationExecutor == nil {
		fakeMigrationExecutor = &NoopMigrationExecutor{}
	}
	sqlKeeper, err := sqlkeeper.NewSQLKeeper(tracer, encryptionManager, encryptedValueStorage, fakeMigrationExecutor, nil, cfg)
	require.NoError(t, err)

	// Initialize a real migration executor for test
	realMigrationExecutor, err := encryptionstorage.ProvideEncryptedValueMigrationExecutor(database, tracer, encryptedValueStorage, globalEncryptedValueStorage)
	require.NoError(t, err)

	mockAwsKeeper := NewModelSecretsManager()
	var keeperService contracts.KeeperService = newKeeperServiceWrapper(sqlKeeper, mockAwsKeeper)

	if setupCfg.KeeperService != nil {
		keeperService = setupCfg.KeeperService
	}

	secureValueValidator := validator.ProvideSecureValueValidator()
	secureValueMutator := mutator.ProvideSecureValueMutator()

	secureValueService := service.ProvideSecureValueService(tracer, accessClient, database, secureValueMetadataStorage, secureValueValidator, secureValueMutator, keeperMetadataStorage, keeperService, nil)

	decryptAuthorizer := decrypt.ProvideDecryptAuthorizer(tracer, nil)

	decryptStorage, err := metadata.ProvideDecryptStorage(tracer, keeperService, keeperMetadataStorage, secureValueMetadataStorage, decryptAuthorizer, nil)
	require.NoError(t, err)

	testCfg := setting.NewCfg()

	decryptService, err := decrypt.ProvideDecryptService(testCfg, tracer, decryptStorage)
	require.NoError(t, err)

	consolidationService := service.ProvideConsolidationService(tracer, globalDataKeyStore, encryptedValueStorage, globalEncryptedValueStorage, encryptionManager)

	garbageCollectionWorker := garbagecollectionworker.ProvideWorker(
		cfg,
		secureValueMetadataStorage,
		keeperMetadataStorage,
		keeperService)

	return Sut{
		SecureValueService:              secureValueService,
		SecureValueMetadataStorage:      secureValueMetadataStorage,
		DecryptStorage:                  decryptStorage,
		DecryptService:                  decryptService,
		EncryptedValueStorage:           encryptedValueStorage,
		GlobalEncryptedValueStorage:     globalEncryptedValueStorage,
		EncryptedValueMigrationExecutor: realMigrationExecutor,
		SQLKeeper:                       sqlKeeper,
		Database:                        database,
		AccessClient:                    accessClient,
		ConsolidationService:            consolidationService,
		EncryptionManager:               encryptionManager,
		GlobalDataKeyStore:              globalDataKeyStore,
		GarbageCollectionWorker:         garbageCollectionWorker,
		Clock:                           clock,
		KeeperService:                   keeperService,
		KeeperMetadataStorage:           keeperMetadataStorage,
		ModelSecretsManager:             mockAwsKeeper,
	}
}

type Sut struct {
	SecureValueService              contracts.SecureValueService
	SecureValueMetadataStorage      contracts.SecureValueMetadataStorage
	DecryptStorage                  contracts.DecryptStorage
	DecryptService                  decryptcontracts.DecryptService
	EncryptedValueStorage           contracts.EncryptedValueStorage
	GlobalEncryptedValueStorage     contracts.GlobalEncryptedValueStorage
	EncryptedValueMigrationExecutor contracts.EncryptedValueMigrationExecutor
	SQLKeeper                       *sqlkeeper.SQLKeeper
	Database                        *database.Database
	AccessClient                    types.AccessClient
	ConsolidationService            contracts.ConsolidationService
	EncryptionManager               contracts.EncryptionManager
	GlobalDataKeyStore              contracts.GlobalDataKeyStorage
	GarbageCollectionWorker         *garbagecollectionworker.Worker
	// The fake clock passed to implementations to make testing easier
	Clock                 *FakeClock
	KeeperService         contracts.KeeperService
	KeeperMetadataStorage contracts.KeeperMetadataStorage
	// A mock of AWS secrets manager that implements contracts.Keeper
	ModelSecretsManager *ModelSecretsManager
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

type CreateKeeperConfig struct {
	// The default keeper payload. Mutate it to change which keeper ends up being created
	Keeper *secretv1beta1.Keeper
}

func (s *Sut) CreateAWSKeeper(ctx context.Context) (*secretv1beta1.Keeper, error) {
	return s.CreateKeeper(ctx, func(cfg *CreateKeeperConfig) {
		cfg.Keeper.Spec = secretv1beta1.KeeperSpec{
			Aws: &secretv1beta1.KeeperAWSConfig{},
		}
	})
}

func (s *Sut) CreateKeeper(ctx context.Context, opts ...func(*CreateKeeperConfig)) (*secretv1beta1.Keeper, error) {
	cfg := CreateKeeperConfig{
		Keeper: &secretv1beta1.Keeper{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "sv1",
				Namespace: "ns1",
			},
			Spec: secretv1beta1.KeeperSpec{
				Aws: &secretv1beta1.KeeperAWSConfig{},
			},
		},
	}
	for _, opt := range opts {
		opt(&cfg)
	}

	return s.KeeperMetadataStorage.Create(ctx, cfg.Keeper, "actor-uid")
}

type keeperServiceWrapper struct {
	sqlKeeper *sqlkeeper.SQLKeeper
	awsKeeper *ModelSecretsManager
}

func newKeeperServiceWrapper(sqlKeeper *sqlkeeper.SQLKeeper, awsKeeper *ModelSecretsManager) *keeperServiceWrapper {
	return &keeperServiceWrapper{sqlKeeper: sqlKeeper, awsKeeper: awsKeeper}
}

func (wrapper *keeperServiceWrapper) KeeperForConfig(cfg secretv1beta1.KeeperConfig) (contracts.Keeper, error) {
	switch cfg.(type) {
	case *secretv1beta1.NamedKeeperConfig[*secretv1beta1.KeeperAWSConfig]:
		return wrapper.awsKeeper, nil
	default:
		return wrapper.sqlKeeper, nil
	}
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

type FakeClock struct {
	Current time.Time
}

func NewFakeClock() *FakeClock {
	return &FakeClock{Current: time.Now()}
}

func (c *FakeClock) Now() time.Time {
	return c.Current
}

func (c *FakeClock) AdvanceBy(duration time.Duration) {
	c.Current = c.Current.Add(duration)
}

type NoopMigrationExecutor struct {
}

func (e *NoopMigrationExecutor) Execute(ctx context.Context) (int, error) {
	return 0, nil
}

// A mock of AWS secrets manager, used for testing.
type ModelSecretsManager struct {
	secrets        map[string]entry
	alreadyDeleted map[string]bool
}

type entry struct {
	exposedValueOrRef string
	externalID        string
}

func NewModelSecretsManager() *ModelSecretsManager {
	return &ModelSecretsManager{
		secrets:        make(map[string]entry),
		alreadyDeleted: make(map[string]bool),
	}
}

func (m *ModelSecretsManager) Store(ctx context.Context, cfg secretv1beta1.KeeperConfig, namespace xkube.Namespace, name string, version int64, exposedValueOrRef string) (externalID contracts.ExternalID, err error) {
	if exposedValueOrRef == "" {
		return "", fmt.Errorf("failed to satisfy constraint: Member must have length greater than or equal to 1")
	}

	versionID := buildVersionID(namespace, name, version)
	if e, ok := m.secrets[versionID]; ok {
		// Ignore duplicated requests
		if e.exposedValueOrRef == exposedValueOrRef {
			return contracts.ExternalID(e.externalID), nil
		}

		// Tried to create a secret that already exists
		return "", fmt.Errorf("ResourceExistsException: The operation failed because the secret %+v already exists.", versionID)

	}

	// First time creating the secret
	entry := entry{
		exposedValueOrRef: exposedValueOrRef,
		externalID:        "external-id",
	}
	m.secrets[versionID] = entry

	return contracts.ExternalID(entry.externalID), nil
}

// Used to simulate the creation of secrets in the 3rd party secret store
func (m *ModelSecretsManager) Create(name, value string) {
	m.secrets[name] = entry{
		exposedValueOrRef: value,
		externalID:        fmt.Sprintf("external_id_%+v", value),
	}
}

func (m *ModelSecretsManager) Expose(ctx context.Context, cfg secretv1beta1.KeeperConfig, namespace xkube.Namespace, name string, version int64) (exposedValue secretv1beta1.ExposedSecureValue, err error) {
	versionID := buildVersionID(namespace, name, version)

	if m.deleted(versionID) {
		return "", fmt.Errorf("InvalidRequestException: You can't perform this operation on the secret because it was marked for deletion.")
	}

	entry, ok := m.secrets[versionID]
	if !ok {
		return "", fmt.Errorf("ResourceNotFoundException: Secrets Manager can't find the specified secret.")
	}

	return secretv1beta1.ExposedSecureValue(entry.exposedValueOrRef), nil
}

// TODO: this could be namespaced to make it more realistic
func (m *ModelSecretsManager) Reference(ctx context.Context, _ secretv1beta1.KeeperConfig, ref string) (secretv1beta1.ExposedSecureValue, error) {
	entry, ok := m.secrets[ref]
	if !ok {
		return "", fmt.Errorf("ResourceNotFoundException: Secrets Manager can't find the specified secret.")
	}
	return secretv1beta1.ExposedSecureValue(entry.exposedValueOrRef), nil
}

func (m *ModelSecretsManager) Delete(ctx context.Context, cfg secretv1beta1.KeeperConfig, namespace xkube.Namespace, name string, version int64) (err error) {
	versionID := buildVersionID(namespace, name, version)

	// Deleting a secret that existed at some point is idempotent
	if m.deleted(versionID) {
		return nil
	}

	// If the secret is being deleted for the first time
	if m.exists(versionID) {
		m.delete(versionID)
	}

	return nil
}

func (m *ModelSecretsManager) deleted(versionID string) bool {
	return m.alreadyDeleted[versionID]
}

func (m *ModelSecretsManager) exists(versionID string) bool {
	_, ok := m.secrets[versionID]
	return ok
}

func (m *ModelSecretsManager) delete(versionID string) {
	m.alreadyDeleted[versionID] = true
	delete(m.secrets, versionID)
}

func buildVersionID(namespace xkube.Namespace, name string, version int64) string {
	return fmt.Sprintf("%s/%s/%d", namespace, name, version)
}
