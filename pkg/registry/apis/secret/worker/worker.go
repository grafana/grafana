package worker

import (
	"context"
	"fmt"
	"time"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	keepertypes "github.com/grafana/grafana/pkg/registry/apis/secret/secretkeeper/types"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
)

type Worker struct {
	config                     Config
	transactionManager         contracts.TransactionManager
	outboxQueue                contracts.OutboxQueue
	secureValueMetadataStorage contracts.SecureValueStorage
	keepers                    map[keepertypes.KeeperType]keepertypes.Keeper
}

type Config struct {
	// The max number of messages to fetch from the outbox queue in a batch
	BatchSize uint
	// How long to wait for a request to fetch messages from the outbox queue
	ReceiveTimeout time.Duration
}

func NewWorker(
	config Config,
	transactionManager contracts.TransactionManager,
	outboxQueue contracts.OutboxQueue,
	secureValueMetadataStorage contracts.SecureValueStorage,
	keepers map[keepertypes.KeeperType]keepertypes.Keeper,
) *Worker {
	return &Worker{
		config:                     config,
		transactionManager:         transactionManager,
		outboxQueue:                outboxQueue,
		secureValueMetadataStorage: secureValueMetadataStorage,
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

func (w *Worker) receiveAndProcessMessages(ctx context.Context) {
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
}

func (w *Worker) processMessage(ctx context.Context, message contracts.OutboxMessage) error {
	// 	// TODO: DECRYPT HERE
	rawSecret := message.EncryptedSecret.DangerouslyExposeAndConsumeValue()

	// 	// TODO: fetch this
	var cfg secretv0alpha1.KeeperConfig

	keeper := w.keepers[keepertypes.KeeperType(message.Keeper)]
	if keeper == nil {
		return fmt.Errorf("worker doesn't have access to keeper, did you forget to pass it to the worker in NewWorker?: %+v", message.Keeper)
	}

	switch message.Type {
	case contracts.CreateSecretOutboxMessage:
		externalID, err := keeper.Store(ctx, cfg, message.Namespace, rawSecret)
		if err != nil {
			return fmt.Errorf("storing secret: message=%+v", message)
		}

		if err := w.secureValueMetadataStorage.SetExternalID(ctx, xkube.Namespace(message.Namespace), message.Name, externalID); err != nil {
			return fmt.Errorf("setting secret metadata externalID: externalID=%+v message=%+v", externalID, message)
		}

	case contracts.UpdateSecretOutboxMessage:
		panic("TODO")

	case contracts.DeleteSecretOutboxMessage:
		panic("TODO")

	default:
		panic(fmt.Sprintf("unhandled message type: %s", message.Type))
	}

	// Setting the status to Succeeded must be the last action
	// since it acts as fence to clients.
	if err := w.secureValueMetadataStorage.SetStatusSucceeded(ctx, xkube.Namespace(message.Namespace), message.Name); err != nil {
		return fmt.Errorf("setting secret metadata status to Succeeded: message=%+v", message)
	}

	return nil
}
