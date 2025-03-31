package worker

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/registry/apis/secret/assert"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"

	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
)

// Consumes and processes messages from the secure value outbox queue
type Worker struct {
	config                     Config
	database                   contracts.Database
	outboxQueue                contracts.OutboxQueue
	secureValueMetadataStorage contracts.SecureValueMetadataStorage
	keeperMetadataStorage      contracts.KeeperMetadataStorage
	keepers                    map[contracts.KeeperType]contracts.Keeper
}

type Config struct {
	// The max number of messages to fetch from the outbox queue in a batch
	BatchSize uint
	// How long to wait for a request to fetch messages from the outbox queue
	ReceiveTimeout time.Duration
}

func NewWorker(
	config Config,
	database contracts.Database,
	outboxQueue contracts.OutboxQueue,
	secureValueMetadataStorage contracts.SecureValueMetadataStorage,
	keeperMetadataStorage contracts.KeeperMetadataStorage,
	keepers map[contracts.KeeperType]contracts.Keeper,
) *Worker {
	return &Worker{
		config:                     config,
		database:                   database,
		outboxQueue:                outboxQueue,
		secureValueMetadataStorage: secureValueMetadataStorage,
		keeperMetadataStorage:      keeperMetadataStorage,
		keepers:                    keepers,
	}
}

// The main method to drive the worker
func (w *Worker) ControlLoop(ctx context.Context) error {
	for {
		select {
		// If the context was canceled
		case <-ctx.Done():
			// return the reason it was canceled
			return ctx.Err()

		// Otherwise try to receive messages
		default:
			w.receiveAndProcessMessages(ctx)
		}
	}
}

// TODO: don't rollback every message when a single error happens
func (w *Worker) receiveAndProcessMessages(ctx context.Context) {
	if err := w.database.Transaction(ctx, func(ctx context.Context) error {
		timeoutCtx, cancel := context.WithTimeout(ctx, w.config.ReceiveTimeout)
		messages, err := w.outboxQueue.ReceiveN(timeoutCtx, w.config.BatchSize)
		cancel()
		if err != nil {
			panic(fmt.Sprintf("TODO: handle error: %+v", err))
		}

		for _, message := range messages {
			if err := w.processMessage(ctx, message); err != nil {
				panic(fmt.Sprintf("TODO: handle error: %+v", err))
			}
		}
		return nil
	}); err != nil {
		panic(fmt.Sprintf("TODO: handle error: %+v", err))
	}
}

func (w *Worker) processMessage(ctx context.Context, message contracts.OutboxMessage) error {
	// TODO: DECRYPT HERE
	rawSecret := message.EncryptedSecret.DangerouslyExposeAndConsumeValue()

	keeperType, keeperCfg, err := w.keeperMetadataStorage.GetKeeperConfig(ctx, message.Namespace, message.Name)
	if err != nil {
		return fmt.Errorf("fetching keeper config: namespace=%+v name=%+v %w", message.Namespace, message.Name, err)
	}
	assert.Equal(keeperType, message.KeeperType, "keeper types should be equal")

	keeper := w.keepers[message.KeeperType]
	if keeper == nil {
		return fmt.Errorf("worker doesn't have access to keeper, did you forget to pass it to the worker in NewWorker?: %+v", message.KeeperType)
	}

	switch message.Type {
	case contracts.CreateSecretOutboxMessage:
		externalID, err := keeper.Store(ctx, keeperCfg, message.Namespace, rawSecret)
		if err != nil {
			return fmt.Errorf("storing secret: message=%+v %w", message, err)
		}

		if err := w.secureValueMetadataStorage.SetExternalID(ctx, xkube.Namespace(message.Namespace), message.Name, externalID); err != nil {
			return fmt.Errorf("setting secret metadata externalID: externalID=%+v message=%+v %w", externalID, message, err)
		}

	case contracts.UpdateSecretOutboxMessage:
		if err := keeper.Update(ctx, keeperCfg, message.Name, contracts.ExternalID(*message.ExternalID), rawSecret); err != nil {
			return fmt.Errorf("calling keeper to update secret: %w", err)
		}

	case contracts.DeleteSecretOutboxMessage:
		if err := keeper.Delete(ctx, keeperCfg, message.Namespace, contracts.ExternalID(*message.ExternalID)); err != nil {
			return fmt.Errorf("calling keeper to delete secret: %w", err)
		}

	default:
		panic(fmt.Sprintf("unhandled message type: %s", message.Type))
	}

	// Setting the status to Succeeded must be the last action
	// since it acts as a fence to clients.
	if err := w.secureValueMetadataStorage.SetStatusSucceeded(ctx, xkube.Namespace(message.Namespace), message.Name); err != nil {
		return fmt.Errorf("setting secret metadata status to Succeeded: message=%+v", message)
	}

	// Delete the message from the queue after setting the status because
	// if the message is deleted first, the response may be lost,
	// resulting in an error, but since the message was actually deleted
	// the worker would never retry.
	if err := w.outboxQueue.Delete(ctx, message.MessageID); err != nil {
		return fmt.Errorf("deleting message from outbox queue: %w", err)
	}

	return nil
}
