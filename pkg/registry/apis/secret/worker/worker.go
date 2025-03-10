package worker

import (
	"context"

	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/secretkeeper/types"
)

type Worker struct {
	// Cancel the context to stop the worker
	ctx                        context.Context
	transactionManager         contracts.TransactionManager
	outboxQueue                contracts.OutboxQueue
	keepers                    map[types.KeeperType]types.Keeper
	secureValueMetadataStorage contracts.SecureValueStorage
}

func NewWorker(
	ctx context.Context,
	transactionManager contracts.TransactionManager,
	outboxQueue contracts.OutboxQueue,
	keepers map[types.KeeperType]types.Keeper,
	secureValueMetadataStorage contracts.SecureValueStorage,
) *Worker {
	return &Worker{ctx: ctx, transactionManager: transactionManager, outboxQueue: outboxQueue, keepers: keepers, secureValueMetadataStorage: secureValueMetadataStorage}
}

func (w *Worker) ReceiveAndProcessMessages(ctx context.Context, keepers map[types.KeeperType]types.Keeper) {

	panic("TODO: Worker.ReceiveAndProcessMessages")
}

// func (w *Worker) onMessagesReceived(messages []contracts.OutboxMessage, err error) {
// 	if err != nil {
// 		// TODO
// 		return
// 	}

// 	for _, message := range messages {
// 		w.processMessage(w.ctx, message)
// 	}
// }

// func (w *Worker) processMessage(ctx context.Context, message contracts.OutboxMessage) {
// 	keeper := w.keepers[types.KeeperType(message.Keeper)]

// 	// TODO: DECRYPT HERE
// 	rawSecret := message.EncryptedSecret

// 	// TODO: fetch this
// 	var cfg secretv0alpha1.KeeperConfig

// 	switch message.Type {
// 	case contracts.CreateSecretOutboxMessage:

// 		// TODO: PASS TX + CB
// 		keeper.Store2(ctx, cfg, message.Namespace, rawSecret, w.onKeeperStoreResponse)

// 	case contracts.UpdateSecretOutboxMessage:
// 		// TODO: PASS TX + CB
// 		err := keeper.Update(ctx, cfg, message.Namespace, types.ExternalID(*message.ExternalID), rawSecret)
// 		if err != nil {
// 			// TODO
// 		}

// 	case contracts.DeleteSecretOutboxMessage:
// 		panic("TODO")

// 	default:
// 		panic(fmt.Sprintf("unhandled message type: %s", message.Type))
// 	}

// 	w.secureValueMetadataStorage.SetStatusSucceeded(ctx, xkube.Namespace(message.Namespace), message.Name, func(err error) {
// 		if err != nil {
// 			onError(err)
// 			return
// 		}

// 		w.outboxQueue.Delete(ctx, xkube.Namespace(message.Namespace), message.Name, func(err error) {
// 			if err != nil {
// 				onError(err)
// 				return
// 			}
// 		})
// 	})
// }

// func (w *Worker) onKeeperStoreResponse(externalID types.ExternalID, err error) {
// 	if err != nil {
// 		// TODO
// 		return
// 	}

// 	w.secureValueMetadataStorage.SetExternalID(ctx, xkube.Namespace(message.Namespace), message.Name, externalID, func(err error) {
// 		if err != nil {
// 			onError(err)
// 			return
// 		}
// 	})
// }
