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
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/reststorage"
	"github.com/grafana/grafana/pkg/registry/apis/secret/secretkeeper/fakes"
	"github.com/grafana/grafana/pkg/registry/apis/secret/service"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/storage/secret/database"
	"github.com/grafana/grafana/pkg/storage/secret/metadata"
	"github.com/grafana/grafana/pkg/storage/secret/migrator"
	"github.com/stretchr/testify/require"
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
		testDB := sqlstore.NewTestStore(t, sqlstore.WithMigrator(migrator.New()))

		database := database.ProvideDatabase(testDB)

		outboxQueueWrapper := newOutboxQueueWrapper(rng, metadata.ProvideOutboxQueue(database))

		features := featuremgmt.WithFeatures(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs, featuremgmt.FlagSecretsManagementAppPlatform)

		// Initialize access client + access control
		accessControl := &actest.FakeAccessControl{ExpectedEvaluate: true}
		accessClient := accesscontrol.NewLegacyAccessClient(accessControl)

		keeperMetadataStorage, err := metadata.ProvideKeeperMetadataStorage(database, features)
		require.NoError(t, err)
		keeperMetadataStorageWrapper := newKeeperMetadataStorageWrapper(rng, keeperMetadataStorage)

		secureValueMetadataStorage, err := metadata.ProvideSecureValueMetadataStorage(database, features)
		require.NoError(t, err)
		secureValueMetadataStorageWrapper := newSecureValueMetadataStorageWrapper(rng, secureValueMetadataStorage)

		sqlKeeperWrapper := newKeeperWrapper(rng, fakes.NewFakeKeeper())
		keeperServiceWrapper := newKeeperServiceWrapper(rng, sqlKeeperWrapper)

		secretService := service.ProvideSecretService(accessClient, database, secureValueMetadataStorage, outboxQueueWrapper)

		secureValueRest := reststorage.NewSecureValueRest(secretService, utils.ResourceInfo{})

		worker := NewWorker(Config{
			// TODO: randomize
			BatchSize:       10,
			ReceiveTimeout:  1 * time.Second,
			PollingInterval: time.Millisecond,
		},
			database,
			outboxQueueWrapper,
			secureValueMetadataStorageWrapper,
			keeperMetadataStorageWrapper,
			keeperServiceWrapper,
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
						Description: fmt.Sprintf("description-%d", i),
						Value:       secretv0alpha1.NewExposedSecureValue(fmt.Sprintf("value-%d", i)),
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
	const secureValuesNotInOutboxQueueQuery = `
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
	rows, err := database.QueryContext(context.Background(), secureValuesNotInOutboxQueueQuery)
	if err != nil {
		panic(err)
	}
	defer func() {
		if err := rows.Close(); err != nil {
			panic(err)
		}
	}()

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

func (wrapper *secureValueMetadataStorageWrapper) Create(ctx context.Context, sv *secretv0alpha1.SecureValue, actorUID string) (*secretv0alpha1.SecureValue, error) {
	return wrapper.impl.Create(ctx, sv, actorUID)
}
func (wrapper *secureValueMetadataStorageWrapper) Read(ctx context.Context, namespace xkube.Namespace, name string, opts contracts.ReadOpts) (*secretv0alpha1.SecureValue, error) {
	return wrapper.impl.Read(ctx, namespace, name, opts)
}
func (wrapper *secureValueMetadataStorageWrapper) Update(ctx context.Context, sv *secretv0alpha1.SecureValue, actorUID string) (*secretv0alpha1.SecureValue, error) {
	// Maybe return an error before calling the real implementation
	if wrapper.rng.Float32() <= 0.2 {
		return nil, context.DeadlineExceeded
	}
	sv, err := wrapper.impl.Update(ctx, sv, actorUID)
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
func (wrapper *secureValueMetadataStorageWrapper) List(ctx context.Context, namespace xkube.Namespace) ([]secretv0alpha1.SecureValue, error) {
	return wrapper.impl.List(ctx, namespace)
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
func (wrapper *secureValueMetadataStorageWrapper) ReadForDecrypt(ctx context.Context, namespace xkube.Namespace, name string) (*contracts.DecryptSecureValue, error) {
	return wrapper.impl.ReadForDecrypt(ctx, namespace, name)
}

type keeperServiceWrapper struct {
	rng    *rand.Rand
	keeper contracts.Keeper
}

func newKeeperServiceWrapper(rng *rand.Rand, keeper contracts.Keeper) *keeperServiceWrapper {
	return &keeperServiceWrapper{rng: rng, keeper: keeper}
}

func (wrapper *keeperServiceWrapper) KeeperForConfig(cfg secretv0alpha1.KeeperConfig) (contracts.Keeper, error) {
	// Maybe return an error before calling the real implementation
	if wrapper.rng.Float32() <= 0.2 {
		return nil, context.DeadlineExceeded
	}

	return wrapper.keeper, nil
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

func (wrapper *keeperMetadataStorageWrapper) Create(_ context.Context, _ *secretv0alpha1.Keeper, _ string) (*secretv0alpha1.Keeper, error) {
	panic("unimplemented")
}
func (wrapper *keeperMetadataStorageWrapper) Read(_ context.Context, _ xkube.Namespace, _ string, _ contracts.ReadOpts) (*secretv0alpha1.Keeper, error) {
	panic("unimplemented")
}
func (wrapper *keeperMetadataStorageWrapper) Update(_ context.Context, _ *secretv0alpha1.Keeper, _ string) (*secretv0alpha1.Keeper, error) {
	panic("unimplemented")
}
func (wrapper *keeperMetadataStorageWrapper) Delete(_ context.Context, _ xkube.Namespace, _ string) error {
	panic("unimplemented")
}
func (wrapper *keeperMetadataStorageWrapper) List(_ context.Context, _ xkube.Namespace) ([]secretv0alpha1.Keeper, error) {
	panic("unimplemented")
}
func (wrapper *keeperMetadataStorageWrapper) GetKeeperConfig(ctx context.Context, namespace string, name *string, opts contracts.ReadOpts) (secretv0alpha1.KeeperConfig, error) {
	// Maybe return an error before calling the real implementation
	if wrapper.rng.Float32() <= 0.2 {
		return nil, context.DeadlineExceeded
	}
	cfg, err := wrapper.impl.GetKeeperConfig(ctx, namespace, name, opts)
	if err != nil {
		return cfg, err
	}
	// Maybe return an error after calling the real implementation
	if wrapper.rng.Float32() <= 0.2 {
		return cfg, context.DeadlineExceeded
	}
	return cfg, nil
}
