package worker

import (
	"context"
	"fmt"
	"math/rand"
	"testing"
	"time"

	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption/cipher"
	encryptionmanager "github.com/grafana/grafana/pkg/registry/apis/secret/encryption/manager"
	"github.com/grafana/grafana/pkg/registry/apis/secret/reststorage"
	"github.com/grafana/grafana/pkg/registry/apis/secret/secretkeeper"
	"github.com/grafana/grafana/pkg/registry/apis/secret/secretkeeper/fakes"
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
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func TestProcessMessage(t *testing.T) {
	t.Parallel()

	seed := time.Now().UnixMicro()
	rng := rand.New(rand.NewSource(seed))

	defer func() {
		if err := recover(); err != nil {
			panic(fmt.Sprintf("TestProcessMessage: err=%+v\n\nSEED=%+v", err, seed))
		}
		if t.Failed() {
			fmt.Printf("TestProcessMessage: SEED=%+v\n\n", seed)
		}
	}()

	for range 10 {
		testDB := sqlstore.NewTestStore(t)
		require.NoError(t, migrator.MigrateSecretSQL(testDB.GetEngine(), nil))

		database := database.New(testDB)

		outboxQueueWrapper := newOutboxQueueWrapper(rng, metadata.ProvideOutboxQueue(testDB))

		features := featuremgmt.WithFeatures(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs, featuremgmt.FlagSecretsManagementAppPlatform)

		dataKeyStore, err := encryptionstorage.ProvideDataKeyStorage(testDB, features)
		require.NoError(t, err)

		encValueStore, err := encryptionstorage.ProvideEncryptedValueStorage(testDB, features)
		require.NoError(t, err)

		encMgr, err := encryptionmanager.ProvideEncryptionManager(
			tracing.InitializeTracerForTest(),
			dataKeyStore,
			&setting.Cfg{
				SecretsManagement: setting.SecretsManagerSettings{
					SecretKey:          "sdDkslslld",
					EncryptionProvider: "secretKey.v1",
					Encryption: setting.EncryptionSettings{
						DataKeysCacheTTL:        5 * time.Minute,
						DataKeysCleanupInterval: 1 * time.Nanosecond,
						Algorithm:               cipher.AesGcm,
					},
				},
			},
			&usagestats.UsageStatsMock{},
			encryption.ProviderMap{},
		)
		require.NoError(t, err)

		// Initialize access client + access control
		accessControl := &actest.FakeAccessControl{ExpectedEvaluate: true}
		accessClient := accesscontrol.NewLegacyAccessClient(accessControl)

		keeperService, err := secretkeeper.ProvideService(tracing.InitializeTracerForTest(), encValueStore, encMgr)
		require.NoError(t, err)

		keeperMetadataStorage, err := metadata.ProvideKeeperMetadataStorage(testDB, features, accessClient)
		require.NoError(t, err)
		keeperMetadataStorageWrapper := newKeeperMetadataStorageWrapper(rng, keeperMetadataStorage)

		secureValueMetadataStorage, err := metadata.ProvideSecureValueMetadataStorage(testDB, features, accessClient, keeperMetadataStorageWrapper, keeperService)
		require.NoError(t, err)
		secureValueMetadataStorageWrapper := newSecureValueMetadataStorageWrapper(rng, secureValueMetadataStorage)

		sqlKeeperWrapper := newKeeperWrapper(rng, fakes.NewFakeKeeper())
		keepers := map[contracts.KeeperType]contracts.Keeper{
			contracts.SQLKeeperType: sqlKeeperWrapper,
		}

		secureValueRest := reststorage.NewSecureValueRest(secureValueMetadataStorage, database, outboxQueueWrapper, utils.ResourceInfo{})

		worker := NewWorker(Config{
			// TODO: randomize
			BatchSize:      10,
			ReceiveTimeout: 1 * time.Second,
		},
			log.New("secret.worker"),
			database,
			outboxQueueWrapper,
			secureValueMetadataStorageWrapper,
			keeperMetadataStorageWrapper,
			keepers,
		)

		for i := range 1000 {
			state := buildState(database)
			action := nextAction(rng, state)

			switch action {
			case actionAppendCreateSecretMessage:
				ctx := createAuthContext(context.Background(), "default", []string{"secret.grafana.app/securevalues/group1:decrypt"}, types.TypeUser)
				sv := &secretv0alpha1.SecureValue{
					ObjectMeta: metav1.ObjectMeta{
						Name:      fmt.Sprintf("sv-%d", i),
						Namespace: fmt.Sprintf("stack-%d", i),
					},
					Spec: secretv0alpha1.SecureValueSpec{
						Title:  fmt.Sprintf("title-%d", i),
						Value:  secretv0alpha1.NewExposedSecureValue(fmt.Sprintf("value-%d", i)),
						Keeper: contracts.DefaultSQLKeeper,
					},
					Status: secretv0alpha1.SecureValueStatus{
						Phase: secretv0alpha1.SecureValuePhasePending,
					},
				}
				validationFunc := func(_ context.Context, _ runtime.Object) error { return nil }
				_, err := secureValueRest.Create(ctx, sv, validationFunc, &metav1.CreateOptions{})
				require.NoError(t, err)

			case actionAppendUpdateSecretMessage:
				i := rng.Intn(len(state.secrets))
				secret := state.secrets[i]
				externalID := string(secret.externalID)

				_, err := outboxQueueWrapper.Append(context.Background(), contracts.AppendOutboxMessage{
					Type:            contracts.UpdateSecretOutboxMessage,
					Name:            secret.name,
					Namespace:       secret.namespace,
					KeeperName:      contracts.DefaultSQLKeeper,
					EncryptedSecret: secretv0alpha1.NewExposedSecureValue(fmt.Sprintf("v-%d", i)),
					ExternalID:      &externalID,
				})
				require.NoError(t, err)

			case actionAppendDeleteSecretMessage:
				i := rng.Intn(len(state.secrets))
				secret := state.secrets[i]
				externalID := string(secret.externalID)

				_, err := outboxQueueWrapper.Append(context.Background(), contracts.AppendOutboxMessage{
					Type:       contracts.DeleteSecretOutboxMessage,
					Name:       secret.name,
					Namespace:  secret.namespace,
					KeeperName: contracts.DefaultSQLKeeper,
					ExternalID: &externalID,
				})
				require.NoError(t, err)

			case actionReceiveAndProcessMessages:
				worker.receiveAndProcessMessages(context.Background())

			default:
				panic(fmt.Sprintf("unhandled action: %+v", action))
			}
		}
	}

	// TODO: more assertions
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

type action string

const (
	actionAppendCreateSecretMessage action = "create"
	actionAppendUpdateSecretMessage action = "update"
	actionAppendDeleteSecretMessage action = "delete"
	actionReceiveAndProcessMessages action = "receive"
)

type state struct {
	secrets []secret
}

type secret struct {
	namespace  string
	name       string
	externalID contracts.ExternalID
}

func enabledActions(state *state) []action {
	enabled := make([]action, 0)

	for _, action := range []action{
		actionAppendCreateSecretMessage,
		actionAppendUpdateSecretMessage,
		actionAppendDeleteSecretMessage,
		actionReceiveAndProcessMessages,
	} {
		switch action {
		case actionAppendCreateSecretMessage:
			enabled = append(enabled, action)

		case actionAppendUpdateSecretMessage, actionAppendDeleteSecretMessage:
			if len(state.secrets) > 0 {
				enabled = append(enabled, action)
			}

		case actionReceiveAndProcessMessages:
			enabled = append(enabled, action)

		default:
			panic(fmt.Sprintf("unhandled action: %+v", action))
		}
	}

	return enabled
}

func nextAction(rng *rand.Rand, state *state) action {
	enabled := enabledActions(state)
	i := rng.Intn(len(enabled))
	return enabled[i]
}

func buildState(database contracts.Database) *state {
	const query = `
	SELECT 
		secret_secure_value.namespace,
		secret_secure_value.name,
		secret_secure_value.external_id
	FROM secret_secure_value
	WHERE NOT EXISTS (
		SELECT 1 FROM secret_secure_value_outbox 
		WHERE secret_secure_value_outbox.namespace = secret_secure_value.namespace
					AND secret_secure_value_outbox.name = secret_secure_value.name
		)
	`
	rows, err := database.QueryContext(context.Background(), query)
	if err != nil {
		panic(err)
	}
	defer rows.Close()

	secrets := make([]secret, 0)

	for rows.Next() {
		var secret secret
		if err := rows.Scan(&secret.namespace, &secret.name, &secret.externalID); err != nil {
			panic(err)
		}
		secrets = append(secrets, secret)
	}

	return &state{secrets: secrets}
}

// A wrapper that injects errors and forwards calls to the real implementation
type outboxQueueWrapper struct {
	rng         *rand.Rand
	outboxQueue contracts.OutboxQueue
}

func newOutboxQueueWrapper(rng *rand.Rand, outboxQueue contracts.OutboxQueue) *outboxQueueWrapper {
	return &outboxQueueWrapper{rng: rng, outboxQueue: outboxQueue}
}

// Append never fails because it is not called by the sut
func (wrapper *outboxQueueWrapper) Append(ctx context.Context, message contracts.AppendOutboxMessage) (string, error) {
	return wrapper.outboxQueue.Append(ctx, message)
}

func (wrapper *outboxQueueWrapper) ReceiveN(ctx context.Context, n uint) ([]contracts.OutboxMessage, error) {
	// Maybe return an error before calling the real implementation
	if wrapper.rng.Float32() <= 0.2 {
		return nil, context.DeadlineExceeded
	}
	messages, err := wrapper.outboxQueue.ReceiveN(ctx, n)
	if err != nil {
		return messages, err
	}
	// Maybe return an error after
	if wrapper.rng.Float32() <= 0.2 {
		return messages, context.DeadlineExceeded
	}
	return messages, err
}

func (wrapper *outboxQueueWrapper) Delete(ctx context.Context, messageID string) error {
	// Maybe return an error before calling the real implementation
	if wrapper.rng.Float32() <= 0.2 {
		return context.DeadlineExceeded
	}
	if err := wrapper.outboxQueue.Delete(ctx, messageID); err != nil {
		return err
	}
	// Maybe return an error after calling the real implementation
	if wrapper.rng.Float32() <= 0.2 {
		return context.DeadlineExceeded
	}
	return nil
}

// A wrapper that injects errors and forwards calls to the real implementation
type secureValueMetadataStorageWrapper struct {
	rng  *rand.Rand
	impl contracts.SecureValueMetadataStorage
}

func newSecureValueMetadataStorageWrapper(rng *rand.Rand, impl contracts.SecureValueMetadataStorage) *secureValueMetadataStorageWrapper {
	return &secureValueMetadataStorageWrapper{rng: rng, impl: impl}
}

func (wrapper *secureValueMetadataStorageWrapper) Create(ctx context.Context, sv *secretv0alpha1.SecureValue) (*secretv0alpha1.SecureValue, error) {
	return wrapper.impl.Create(ctx, sv)
}
func (wrapper *secureValueMetadataStorageWrapper) Read(ctx context.Context, namespace xkube.Namespace, name string) (*secretv0alpha1.SecureValue, error) {
	return wrapper.impl.Read(ctx, namespace, name)
}
func (wrapper *secureValueMetadataStorageWrapper) Update(ctx context.Context, sv *secretv0alpha1.SecureValue) (*secretv0alpha1.SecureValue, error) {
	// Maybe return an error before calling the real implementation
	if wrapper.rng.Float32() <= 0.2 {
		return nil, context.DeadlineExceeded
	}
	sv, err := wrapper.impl.Update(ctx, sv)
	if err != nil {
		return sv, err
	}
	// Maybe return an error after calling the real implementation
	if wrapper.rng.Float32() <= 0.2 {
		return nil, context.DeadlineExceeded
	}
	return sv, err
}
func (wrapper *secureValueMetadataStorageWrapper) Delete(ctx context.Context, namespace xkube.Namespace, name string) error {
	// Maybe return an error before calling the real implementation
	if wrapper.rng.Float32() <= 0.2 {
		return context.DeadlineExceeded
	}
	if err := wrapper.impl.Delete(ctx, namespace, name); err != nil {
		return err
	}
	// Maybe return an error after calling the real implementation
	if wrapper.rng.Float32() <= 0.2 {
		return context.DeadlineExceeded
	}
	return nil
}
func (wrapper *secureValueMetadataStorageWrapper) List(ctx context.Context, namespace xkube.Namespace, options *internalversion.ListOptions) (*secretv0alpha1.SecureValueList, error) {
	return wrapper.impl.List(ctx, namespace, options)
}

func (wrapper *secureValueMetadataStorageWrapper) SetStatusSucceeded(ctx context.Context, namespace xkube.Namespace, name string) error {
	// Maybe return an error before calling the real implementation
	if wrapper.rng.Float32() <= 0.2 {
		return context.DeadlineExceeded
	}
	if err := wrapper.impl.SetStatusSucceeded(ctx, namespace, name); err != nil {
		return err
	}
	// Maybe return an error after calling the real implementation
	if wrapper.rng.Float32() <= 0.2 {
		return context.DeadlineExceeded
	}
	return nil
}
func (wrapper *secureValueMetadataStorageWrapper) SetExternalID(ctx context.Context, namespace xkube.Namespace, name string, externalID contracts.ExternalID) error {
	// Maybe return an error before calling the real implementation
	if wrapper.rng.Float32() <= 0.2 {
		return context.DeadlineExceeded
	}
	if err := wrapper.impl.SetExternalID(ctx, namespace, name, externalID); err != nil {
		return err
	}
	// Maybe return an error after calling the real implementation
	if wrapper.rng.Float32() <= 0.2 {
		return context.DeadlineExceeded
	}
	return nil
}

type keeperWrapper struct {
	rng    *rand.Rand
	keeper contracts.Keeper
}

func newKeeperWrapper(rng *rand.Rand, keeper contracts.Keeper) *keeperWrapper {
	return &keeperWrapper{rng: rng, keeper: keeper}
}

func (wrapper *keeperWrapper) Store(ctx context.Context, cfg secretv0alpha1.KeeperConfig, namespace string, exposedValueOrRef string) (contracts.ExternalID, error) {
	// Maybe return an error before calling the real implementation
	if wrapper.rng.Float32() <= 0.2 {
		return "", context.DeadlineExceeded
	}
	externalID, err := wrapper.keeper.Store(ctx, cfg, namespace, exposedValueOrRef)
	if err != nil {
		return externalID, err
	}
	// Maybe return an error after calling the real implementation
	if wrapper.rng.Float32() <= 0.2 {
		return externalID, context.DeadlineExceeded
	}
	return externalID, nil
}

func (wrapper *keeperWrapper) Update(ctx context.Context, cfg secretv0alpha1.KeeperConfig, namespace string, externalID contracts.ExternalID, exposedValueOrRef string) error {
	// Maybe return an error before calling the real implementation
	if wrapper.rng.Float32() <= 0.2 {
		return context.DeadlineExceeded
	}
	if err := wrapper.keeper.Update(ctx, cfg, namespace, externalID, exposedValueOrRef); err != nil {
		return err
	}
	// Maybe return an error after calling the real implementation
	if wrapper.rng.Float32() <= 0.2 {
		return context.DeadlineExceeded
	}
	return nil
}

func (wrapper *keeperWrapper) Expose(ctx context.Context, cfg secretv0alpha1.KeeperConfig, namespace string, externalID contracts.ExternalID) (secretv0alpha1.ExposedSecureValue, error) {
	var zero secretv0alpha1.ExposedSecureValue
	// Maybe return an error before calling the real implementation
	if wrapper.rng.Float32() <= 0.2 {
		return zero, context.DeadlineExceeded
	}
	sv, err := wrapper.keeper.Expose(ctx, cfg, namespace, externalID)
	if err != nil {
		return sv, err
	}
	// Maybe return an error after calling the real implementation
	if wrapper.rng.Float32() <= 0.2 {
		return sv, context.DeadlineExceeded
	}
	return sv, nil
}

func (wrapper *keeperWrapper) Delete(ctx context.Context, cfg secretv0alpha1.KeeperConfig, namespace string, externalID contracts.ExternalID) error {
	// Maybe return an error before calling the real implementation
	if wrapper.rng.Float32() <= 0.2 {
		return context.DeadlineExceeded
	}
	if err := wrapper.keeper.Delete(ctx, cfg, namespace, externalID); err != nil {
		return err
	}
	// Maybe return an error after calling the real implementation
	if wrapper.rng.Float32() <= 0.2 {
		return context.DeadlineExceeded
	}
	return nil
}

type keeperMetadataStorageWrapper struct {
	rng  *rand.Rand
	impl contracts.KeeperMetadataStorage
}

func newKeeperMetadataStorageWrapper(rng *rand.Rand, impl contracts.KeeperMetadataStorage) *keeperMetadataStorageWrapper {
	return &keeperMetadataStorageWrapper{rng: rng, impl: impl}
}

func (wrapper *keeperMetadataStorageWrapper) Create(_ context.Context, _ *secretv0alpha1.Keeper) (*secretv0alpha1.Keeper, error) {
	panic("unimplemented")
}
func (wrapper *keeperMetadataStorageWrapper) Read(_ context.Context, _ xkube.Namespace, _ string) (*secretv0alpha1.Keeper, error) {
	panic("unimplemented")
}
func (wrapper *keeperMetadataStorageWrapper) Update(_ context.Context, _ *secretv0alpha1.Keeper) (*secretv0alpha1.Keeper, error) {
	panic("unimplemented")
}
func (wrapper *keeperMetadataStorageWrapper) Delete(_ context.Context, _ xkube.Namespace, _ string) error {
	panic("unimplemented")
}
func (wrapper *keeperMetadataStorageWrapper) List(_ context.Context, _ xkube.Namespace, _ *internalversion.ListOptions) (*secretv0alpha1.KeeperList, error) {
	panic("unimplemented")
}
func (wrapper *keeperMetadataStorageWrapper) GetKeeperConfig(ctx context.Context, namespace, name string) (contracts.KeeperType, secretv0alpha1.KeeperConfig, error) {
	// Maybe return an error before calling the real implementation
	if wrapper.rng.Float32() <= 0.2 {
		return "", nil, context.DeadlineExceeded
	}
	keeperType, cfg, err := wrapper.impl.GetKeeperConfig(ctx, namespace, name)
	if err != nil {
		return keeperType, cfg, err
	}
	// Maybe return an error after calling the real implementation
	if wrapper.rng.Float32() <= 0.2 {
		return keeperType, cfg, context.DeadlineExceeded
	}
	return keeperType, cfg, nil
}
