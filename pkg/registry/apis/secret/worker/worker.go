package worker

import (
	"context"
	"errors"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/secretkeeper"
	"github.com/grafana/grafana/pkg/registry/apis/secret/secretkeeper/types"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
)

type Worker struct {
	transactionManager         contracts.TransactionManager
	outboxQueue                contracts.OutboxQueue
	keeperSvc                  secretkeeper.Service
	secureValueMetadataStorage contracts.SecureValueStorage
}

func NewWorker(
	transactionManager contracts.TransactionManager,
	outboxQueue contracts.OutboxQueue,
	keeperSvc secretkeeper.Service,
	secureValueMetadataStorage contracts.SecureValueStorage,
) *Worker {
	return &Worker{transactionManager, outboxQueue, keeperSvc, secureValueMetadataStorage}
}

func (w *Worker) Work(ctx context.Context) {
	var cfg secretv0alpha1.KeeperConfig

	for {
		// TODO: this executing all the time is not good because it goes to the db
		keepers, err := w.keeperSvc.GetKeepers()
		if err != nil {
			panic(err)
		}

		w.transactionManager.BeginTx(ctx, nil, func(tx contracts.Tx, err error) {
			onError := func(err error) {
				tx.Rollback(func(txErr error) {
					panic(errors.Join(err, txErr)) // TODO: log, increment and send to DLQ
				})
			}
			if err != nil {
				onError(err)
				return
			}

			w.outboxQueue.ReceiveN(ctx, tx, 1, func(messages []contracts.OutboxMessage, err error) {
				if err != nil {
					onError(err)
					return
				}

				for _, message := range messages {
					//StoreSecretValue
					keeperType := keepers[types.KeeperType(message.Keeper)]

					// TODO: DECRYPT HERE
					rawSecret := message.EncryptedSecret

					if message.ExternalID != nil {
						// TODO: PASS TX + CB
						err := keeperType.Update(ctx, cfg, message.Namespace, types.ExternalID(*message.ExternalID), rawSecret)
						if err != nil {
							onError(err)
							return
						}
					} else {
						// TODO: PASS TX + CB
						externalID, err := keeperType.Store(ctx, cfg, message.Namespace, rawSecret)
						if err != nil {
							onError(err)
							return
						}

						w.secureValueMetadataStorage.SetExternalID(ctx, tx, xkube.Namespace(message.Namespace), message.Name, externalID, func(err error) {
							if err != nil {
								onError(err)
								return
							}
						})
					}

					// DeleteMsgFromQueue
					w.outboxQueue.Delete(ctx, tx, xkube.Namespace(message.Namespace), message.Name, func(err error) {
						if err != nil {
							onError(err)
							return
						}

						w.secureValueMetadataStorage.SetStatusSucceeded(ctx, tx, xkube.Namespace(message.Namespace), message.Name, func(err error) {
							if err != nil {
								onError(err)
								return
							}

							tx.Commit(func(err error) {
								if err != nil {
									onError(err)
									return
								}
							})
						})
					})
				}
			})
		})
	}
}
