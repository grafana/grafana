package worker

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
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
	keeperService              contracts.KeeperService
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
	keeperService contracts.KeeperService,
) *Worker {
	return &Worker{
		config:                     config,
		database:                   database,
		outboxQueue:                outboxQueue,
		secureValueMetadataStorage: secureValueMetadataStorage,
		keeperMetadataStorage:      keeperMetadataStorage,
		keeperService:              keeperService,
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
			return err
		}

		for _, message := range messages {
			if err := w.processMessage(ctx, message); err != nil {
				return fmt.Errorf("processing message: %+v %w", message, err)
			}
		}
		return nil
	}); err != nil {
		logging.FromContext(ctx).Error("receiving outbox messages", "err", err.Error())
	}
}

func (w *Worker) processMessage(ctx context.Context, message contracts.OutboxMessage) error {
	keeperCfg, err := w.keeperMetadataStorage.GetKeeperConfig(ctx, message.Namespace, message.KeeperName)
	if err != nil {
		return fmt.Errorf("fetching keeper config: namespace=%+v keeperName=%+v %w", message.Namespace, message.KeeperName, err)
	}

	keeper, err := w.keeperService.KeeperForConfig(keeperCfg)
	if err != nil {
		return fmt.Errorf("getting keeper for config: namespace=%+v keeperName=%+v %w", message.Namespace, message.KeeperName, err)
	}
	if keeper == nil {
		return fmt.Errorf("worker doesn't have access to keeper, did you forget to pass it to the worker in NewWorker?: %+v", keeperCfg.Type())
	}

	switch message.Type {
	case contracts.CreateSecretOutboxMessage:
		// TODO: DECRYPT HERE
		rawSecret := message.EncryptedSecret.DangerouslyExposeAndConsumeValue()

		externalID, err := keeper.Store(ctx, keeperCfg, message.Namespace, rawSecret)
		if err != nil {
			return fmt.Errorf("storing secret: message=%+v %w", message, err)
		}

		if err := w.secureValueMetadataStorage.SetExternalID(ctx, xkube.Namespace(message.Namespace), message.Name, externalID); err != nil {
			return fmt.Errorf("setting secret metadata externalID: externalID=%+v message=%+v %w", externalID, message, err)
		}

		// Setting the status to Succeeded must be the last action
		// since it acts as a fence to clients.
		if err := w.secureValueMetadataStorage.SetStatus(ctx, xkube.Namespace(message.Namespace), message.Name, secretv0alpha1.SecureValueStatus{Phase: secretv0alpha1.SecureValuePhaseSucceeded}); err != nil {
			return fmt.Errorf("setting secret metadata status to Succeeded: message=%+v", message)
		}

	case contracts.UpdateSecretOutboxMessage:
		// TODO: DECRYPT HERE
		rawSecret := message.EncryptedSecret.DangerouslyExposeAndConsumeValue()

		if err := keeper.Update(ctx, keeperCfg, message.Name, contracts.ExternalID(*message.ExternalID), rawSecret); err != nil {
			return fmt.Errorf("calling keeper to update secret: %w", err)
		}

		// Setting the status to Succeeded must be the last action
		// since it acts as a fence to clients.
		if err := w.secureValueMetadataStorage.SetStatus(ctx, xkube.Namespace(message.Namespace), message.Name, secretv0alpha1.SecureValueStatus{Phase: secretv0alpha1.SecureValuePhaseSucceeded}); err != nil {
			return fmt.Errorf("setting secret metadata status to Succeeded: message=%+v", message)
		}

	case contracts.DeleteSecretOutboxMessage:
		if err := keeper.Delete(ctx, keeperCfg, message.Namespace, contracts.ExternalID(*message.ExternalID)); err != nil {
			return fmt.Errorf("calling keeper to delete secret: %w", err)
		}
		if err := w.secureValueMetadataStorage.Delete(ctx, xkube.Namespace(message.Namespace), message.Name); err != nil {
			return fmt.Errorf("deleting secure value metadata: %+w", err)
		}

	default:
		return fmt.Errorf("unhandled message type: %s", message.Type)
	}

	// Delete the message from the queue after completing all operations because
	// if the message is deleted first, the response may be lost,
	// resulting in an error, but since the message was actually deleted
	// the worker would never retry.
	if err := w.outboxQueue.Delete(ctx, message.MessageID); err != nil {
		return fmt.Errorf("deleting message from outbox queue: %w", err)
	}

	return nil
}
