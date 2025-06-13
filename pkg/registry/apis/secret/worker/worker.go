package worker

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/metrics"
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
	encryptionManager          contracts.EncryptionManager
	metrics                    *metrics.SecretsMetrics
}

type Config struct {
	// The max number of messages to fetch from the outbox queue in a batch
	BatchSize uint
	// How long to wait for a request to fetch messages from the outbox queue
	ReceiveTimeout time.Duration
	// How often to poll the outbox queue for new messages
	PollingInterval time.Duration
	// How many tries to try to process a message before marking the operation as failed
	MaxMessageProcessingAttempts uint
}

func NewWorker(
	config Config,
	database contracts.Database,
	outboxQueue contracts.OutboxQueue,
	secureValueMetadataStorage contracts.SecureValueMetadataStorage,
	keeperMetadataStorage contracts.KeeperMetadataStorage,
	keeperService contracts.KeeperService,
	encryptionManager contracts.EncryptionManager,
	metrics *metrics.SecretsMetrics,
) (*Worker, error) {
	if config.BatchSize == 0 {
		return nil, fmt.Errorf("config.BatchSize is required")
	}
	if config.ReceiveTimeout == 0 {
		return nil, fmt.Errorf("config.ReceiveTimeout is required")
	}
	if config.PollingInterval == 0 {
		return nil, fmt.Errorf("config.PollingInterval is required")
	}
	if config.MaxMessageProcessingAttempts == 0 {
		return nil, fmt.Errorf("config.MaxMessageProcessingAttempts is required")
	}

	return &Worker{
		config:                     config,
		database:                   database,
		outboxQueue:                outboxQueue,
		secureValueMetadataStorage: secureValueMetadataStorage,
		keeperMetadataStorage:      keeperMetadataStorage,
		keeperService:              keeperService,
		encryptionManager:          encryptionManager,
		metrics:                    metrics,
	}, nil
}

// The main method to drive the worker
func (w *Worker) ControlLoop(ctx context.Context) error {
	logging.FromContext(ctx).Debug("starting worker control loop")
	t := time.NewTicker(w.config.PollingInterval)
	defer t.Stop()

	for {
		select {
		// If the context was canceled
		case <-ctx.Done():
			// return the reason it was canceled
			return ctx.Err()

		// Otherwise try to receive messages
		case <-t.C:
			if ctx.Err() != nil {
				return ctx.Err()
			}

			if err := w.ReceiveAndProcessMessages(ctx); err != nil {
				logging.FromContext(ctx).Error("receiving outbox messages", "err", err.Error())
			}
		}
	}
}

// TODO: don't rollback every message when a single error happens
func (w *Worker) ReceiveAndProcessMessages(ctx context.Context) error {
	messageIDs := make([]string, 0)

	txErr := w.database.Transaction(ctx, func(ctx context.Context) error {
		timeoutCtx, cancel := context.WithTimeout(ctx, w.config.ReceiveTimeout)
		messages, err := w.outboxQueue.ReceiveN(timeoutCtx, w.config.BatchSize)
		cancel()
		if err != nil {
			return err
		}

		for _, message := range messages {
			messageIDs = append(messageIDs, message.MessageID)
			ctx := contracts.ContextWithRequestID(ctx, message.RequestID)
			if err := w.processMessage(ctx, message); err != nil {
				return fmt.Errorf("processing message: %+v %w", message, err)
			}
		}
		return nil
	})

	// This call is made outside the transaction to make sure the receive count is updated on rollbacks.
	incrementErr := w.outboxQueue.IncrementReceiveCount(ctx, messageIDs)
	if incrementErr != nil {
		incrementErr = fmt.Errorf("incrementing receive count for outbox message: %w", incrementErr)
	}

	return errors.Join(txErr, incrementErr)
}

func (w *Worker) processMessage(ctx context.Context, message contracts.OutboxMessage) error {
	start := time.Now()
	var keeperType string
	defer func() {
		w.metrics.OutboxMessageProcessingDuration.WithLabelValues(string(message.Type), keeperType).Observe(time.Since(start).Seconds())
	}()

	logging.FromContext(ctx).Debug("processing message", "type", message.Type, "name", message.Name, "namespace", message.Namespace, "receiveCount", message.ReceiveCount)

	if message.ReceiveCount >= int(w.config.MaxMessageProcessingAttempts) {
		if err := w.secureValueMetadataStorage.SetStatus(ctx, xkube.Namespace(message.Namespace), message.Name, secretv0alpha1.SecureValueStatus{Phase: secretv0alpha1.SecureValuePhaseFailed, Message: fmt.Sprintf("Reached max number of attempts to complete operation: %s", message.Type)}); err != nil {
			return fmt.Errorf("setting secret metadata status to Succeeded: message=%+v", message)
		}
		if err := w.outboxQueue.Delete(ctx, message.MessageID); err != nil {
			return fmt.Errorf("deleting message from outbox queue: %w", err)
		}
		return nil
	}

	keeperCfg, err := w.keeperMetadataStorage.GetKeeperConfig(ctx, message.Namespace, message.KeeperName, contracts.ReadOpts{ForUpdate: true})
	if err != nil {
		return fmt.Errorf("fetching keeper config: namespace=%+v keeperName=%+v %w", message.Namespace, message.KeeperName, err)
	}

	keeper, err := w.keeperService.KeeperForConfig(keeperCfg)
	if err != nil {
		return fmt.Errorf("getting keeper for config: namespace=%+v keeperName=%+v %w", message.Namespace, message.KeeperName, err)
	}
	logging.FromContext(ctx).Debug("retrieved keeper", "namespace", message.Namespace, "keeperName", message.KeeperName, "type", keeperCfg.Type())

	switch message.Type {
	case contracts.CreateSecretOutboxMessage:
		rawSecret, err := w.encryptionManager.Decrypt(ctx, message.Namespace, []byte(message.EncryptedSecret))
		if err != nil {
			return fmt.Errorf("decrypting secure value secret: %w", err)
		}

		externalID, err := keeper.Store(ctx, keeperCfg, message.Namespace, string(rawSecret))
		if err != nil {
			return fmt.Errorf("storing secret: message=%+v %w", message, err)
		}

		if err := w.secureValueMetadataStorage.SetExternalID(ctx, xkube.Namespace(message.Namespace), message.Name, externalID); err != nil {
			return fmt.Errorf("setting secret metadata externalID: externalID=%+v message=%+v %w", externalID, message, err)
		}

		// Setting the status to Succeeded must be the last action
		// since it acts as a fence to clients.
		if err := w.secureValueMetadataStorage.SetStatus(ctx, xkube.Namespace(message.Namespace), message.Name, secretv0alpha1.SecureValueStatus{Phase: secretv0alpha1.SecureValuePhaseSucceeded}); err != nil {
			return fmt.Errorf("setting secret metadata status to Succeeded: message=%+v %w", message, err)
		}

	case contracts.UpdateSecretOutboxMessage:
		rawSecret, err := w.encryptionManager.Decrypt(ctx, message.Namespace, []byte(message.EncryptedSecret))
		if err != nil {
			return fmt.Errorf("decrypting secure value secret: %w", err)
		}

		if err := keeper.Update(ctx, keeperCfg, message.Namespace, contracts.ExternalID(*message.ExternalID), string(rawSecret)); err != nil {
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
