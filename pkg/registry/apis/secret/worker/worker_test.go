package worker_test

import (
	"context"
	"fmt"
	"testing"
	"time"

	secretv1beta1 "github.com/grafana/grafana/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/testutils"
	"github.com/grafana/grafana/pkg/registry/apis/secret/worker"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"github.com/stretchr/testify/require"
)

type fakeKeeperService struct {
	keeperForConfigFunc func(cfg secretv1beta1.KeeperConfig) (contracts.Keeper, error)
}

func newFakeKeeperService(keeperForConfigFunc func(cfg secretv1beta1.KeeperConfig) (contracts.Keeper, error)) *fakeKeeperService {
	return &fakeKeeperService{keeperForConfigFunc: keeperForConfigFunc}
}

func (s *fakeKeeperService) KeeperForConfig(cfg secretv1beta1.KeeperConfig) (contracts.Keeper, error) {
	return s.keeperForConfigFunc(cfg)
}

func TestProcessMessage(t *testing.T) {
	t.Parallel()

	t.Run("secure value metadata status is set to Failed when processing a message fails too many times", func(t *testing.T) {
		t.Parallel()

		// Given a worker that will attempt to process a message N times
		workerCfg := worker.Config{
			BatchSize:                    10,
			ReceiveTimeout:               1 * time.Second,
			PollingInterval:              time.Millisecond,
			MaxMessageProcessingAttempts: 2,
		}

		// And an error that keeps happening
		keeperService := newFakeKeeperService(func(cfg secretv1beta1.KeeperConfig) (contracts.Keeper, error) {
			return nil, fmt.Errorf("oops")
		})

		sut := testutils.Setup(t, testutils.WithWorkerConfig(workerCfg), testutils.WithKeeperService(keeperService))
		ctx := context.Background()

		// Queue a create secure value operation
		sv, err := sut.CreateSv(ctx)
		require.NoError(t, err)

		for range workerCfg.MaxMessageProcessingAttempts + 1 {
			// The secure value status should be Pending while the worker is trying to process the message
			sv, err = sut.SecureValueMetadataStorage.Read(ctx, xkube.Namespace(sv.Namespace), sv.Name, contracts.ReadOpts{})
			require.NoError(t, err)
			require.Equal(t, secretv1beta1.SecureValuePhasePending, sv.Status.Phase)

			// Worker tries to process messages
			_ = sut.Worker.ReceiveAndProcessMessages(ctx)
		}

		// After the worker fails to process a message too many times,
		// the secure value status is changed to Failed
		sv, err = sut.SecureValueMetadataStorage.Read(ctx, xkube.Namespace(sv.Namespace), sv.Name, contracts.ReadOpts{})
		require.NoError(t, err)
		require.Equal(t, secretv1beta1.SecureValuePhaseFailed, sv.Status.Phase)

		messages, err := sut.OutboxQueue.ReceiveN(ctx, 100)
		require.NoError(t, err)
		require.Empty(t, messages)
	})

	t.Run("create sv: secure value metadata status is set to Succeeded when message is processed successfully", func(t *testing.T) {
		t.Parallel()

		sut := testutils.Setup(t)
		ctx := context.Background()

		// Queue a create secure value operation
		sv, err := sut.CreateSv(ctx)
		require.NoError(t, err)

		// Worker receives and processes the message
		require.NoError(t, sut.Worker.ReceiveAndProcessMessages(ctx))

		// and sets the secure value status to Succeeded
		sv, err = sut.SecureValueMetadataStorage.Read(ctx, xkube.Namespace(sv.Namespace), sv.Name, contracts.ReadOpts{})
		require.NoError(t, err)
		require.Equal(t, secretv1beta1.SecureValuePhaseSucceeded, sv.Status.Phase)

		messages, err := sut.OutboxQueue.ReceiveN(ctx, 100)
		require.NoError(t, err)
		require.Empty(t, messages)
	})

	t.Run("update sv: secure value metadata status is set to Succeeded when message is processed successfully", func(t *testing.T) {
		t.Parallel()

		sut := testutils.Setup(t)
		ctx := context.Background()

		// Queue a create secure value operation
		sv, err := sut.CreateSv(ctx)
		require.NoError(t, err)

		// Worker receives and processes the message
		require.NoError(t, sut.Worker.ReceiveAndProcessMessages(ctx))

		// and sets the secure value status to Succeeded
		sv, err = sut.SecureValueMetadataStorage.Read(ctx, xkube.Namespace(sv.Namespace), sv.Name, contracts.ReadOpts{})
		require.NoError(t, err)
		require.Equal(t, secretv1beta1.SecureValuePhaseSucceeded, sv.Status.Phase)

		sv.Spec.Description = "desc2"
		sv.Spec.Value = secretv1beta1.NewExposedSecureValue("v2")

		// Queue an update operation
		sv, err = sut.UpdateSv(ctx, sv)
		require.NoError(t, err)
		require.Equal(t, secretv1beta1.SecureValuePhasePending, sv.Status.Phase)

		// Worker receives and processes the message
		require.NoError(t, sut.Worker.ReceiveAndProcessMessages(ctx))
		updatedSv, err := sut.SecureValueMetadataStorage.Read(ctx, xkube.Namespace(sv.Namespace), sv.Name, contracts.ReadOpts{})
		require.NoError(t, err)
		require.Equal(t, secretv1beta1.SecureValuePhaseSucceeded, updatedSv.Status.Phase)
		require.Equal(t, sv.Spec.Description, updatedSv.Spec.Description)

		messages, err := sut.OutboxQueue.ReceiveN(ctx, 100)
		require.NoError(t, err)
		require.Empty(t, messages)
	})

	t.Run("delete sv: secure value metadata is deleted", func(t *testing.T) {
		t.Parallel()

		sut := testutils.Setup(t)
		ctx := context.Background()

		// Queue a create secure value operation
		sv, err := sut.CreateSv(ctx)
		require.NoError(t, err)

		// Worker receives and processes the message
		require.NoError(t, sut.Worker.ReceiveAndProcessMessages(ctx))

		// and sets the secure value status to Succeeded
		sv, err = sut.SecureValueMetadataStorage.Read(ctx, xkube.Namespace(sv.Namespace), sv.Name, contracts.ReadOpts{})
		require.NoError(t, err)
		require.Equal(t, secretv1beta1.SecureValuePhaseSucceeded, sv.Status.Phase)

		// Queue a delete operation
		updatedSv, err := sut.DeleteSv(ctx, sv.Namespace, sv.Name)
		require.NoError(t, err)
		require.Equal(t, secretv1beta1.SecureValuePhasePending, updatedSv.Status.Phase)

		// Worker receives and processes the message
		require.NoError(t, sut.Worker.ReceiveAndProcessMessages(ctx))

		// The secure value has been deleted
		_, err = sut.SecureValueMetadataStorage.Read(ctx, xkube.Namespace(sv.Namespace), sv.Name, contracts.ReadOpts{})
		require.ErrorIs(t, err, contracts.ErrSecureValueNotFound)

		messages, err := sut.OutboxQueue.ReceiveN(ctx, 100)
		require.NoError(t, err)
		require.Empty(t, messages)
	})

	t.Run("when creating a secure value, the secret is encrypted before it is added to the outbox queue", func(t *testing.T) {
		t.Parallel()

		sut := testutils.Setup(t)
		ctx := context.Background()

		// Queue a create secure value operation
		var secret string
		_, err := sut.CreateSv(ctx, func(cfg *testutils.CreateSvConfig) {
			secret = string(cfg.Sv.Spec.Value)
		})
		require.NoError(t, err)

		messages, err := sut.OutboxQueue.ReceiveN(ctx, 100)
		require.NoError(t, err)
		require.Equal(t, 1, len(messages))

		encryptedSecret := messages[0].EncryptedSecret
		require.NotEmpty(t, secret)
		require.NotEmpty(t, encryptedSecret)
		require.NotEqual(t, secret, encryptedSecret)
	})

	t.Run("when updating a secure value, the secret is encrypted before it is added to the outbox queue", func(t *testing.T) {
		t.Parallel()

		sut := testutils.Setup(t)
		ctx := context.Background()

		// Queue a create secure value operation
		sv, err := sut.CreateSv(ctx)
		require.NoError(t, err)
		sv.Spec.Value = secretv1beta1.NewExposedSecureValue("v2")

		require.NoError(t, sut.Worker.ReceiveAndProcessMessages(ctx))

		newValue := "v2"
		sv.Spec.Value = secretv1beta1.NewExposedSecureValue(newValue)

		// Queue an update secure value operation
		_, err = sut.UpdateSv(ctx, sv)
		require.NoError(t, err)

		messages, err := sut.OutboxQueue.ReceiveN(ctx, 100)
		require.NoError(t, err)
		require.Equal(t, 1, len(messages))

		encryptedSecret := messages[0].EncryptedSecret
		require.NotEmpty(t, encryptedSecret)
		require.NotEqual(t, newValue, encryptedSecret)
	})

	t.Run("when deleting a secure value, no value is added to the outbox message", func(t *testing.T) {
		t.Parallel()

		sut := testutils.Setup(t)
		ctx := context.Background()

		// Queue a create secure value operation
		sv, err := sut.CreateSv(ctx)
		require.NoError(t, err)
		sv.Spec.Value = secretv1beta1.NewExposedSecureValue("v2")

		require.NoError(t, sut.Worker.ReceiveAndProcessMessages(ctx))

		// Queue a delete secure value operation
		_, err = sut.DeleteSv(ctx, sv.Namespace, sv.Name)
		require.NoError(t, err)

		messages, err := sut.OutboxQueue.ReceiveN(ctx, 100)
		require.NoError(t, err)
		require.Equal(t, 1, len(messages))
		require.Empty(t, messages[0].EncryptedSecret)
	})
}
