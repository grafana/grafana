package services

import (
	"context"
	"errors"
	"fmt"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"k8s.io/apimachinery/pkg/runtime"
)

type CreateSecureValue struct {
	transactionManager         contracts.TransactionManager
	secureValueMetadataStorage contracts.SecureValueStorage
	outboxQueue                contracts.OutboxQueue
}

func NewCreateSecureValue(
	tx contracts.TransactionManager,
	secureValueMetadataStorage contracts.SecureValueStorage,
	outboxQueue contracts.OutboxQueue,
) *CreateSecureValue {
	return &CreateSecureValue{tx, secureValueMetadataStorage, outboxQueue}
}

func (s *CreateSecureValue) Handle(ctx context.Context, sv *secretv0alpha1.SecureValue, cb func(runtime.Object, error)) {
	s.transactionManager.BeginTx(ctx, nil, func(tx contracts.Tx, err error) {
		onError := func(err error) {
			tx.Rollback(func(txErr error) {
				cb(nil, errors.Join(err, txErr))
			})
		}
		if err != nil {
			onError(err)
			return
		}

		s.secureValueMetadataStorage.SecretMetadataHasPendingStatus(ctx, tx, xkube.Namespace(sv.Namespace), sv.Name,
			func(isPending bool, err error) {
				if err != nil {
					onError(fmt.Errorf("failed to create secure value: %w", err))
					return
				}

				if isPending {
					onError(fmt.Errorf("already pending"))
					return
				}

				// TODO: Consume sv.rawSecret and encrypt value here before storing!
				// TODO: handle REF vs VALUE
				_ = sv.Spec.Value.DangerouslyExposeAndConsumeValue()

				s.secureValueMetadataStorage.Create(ctx, tx, sv, func(createdSecureValue *secretv0alpha1.SecureValue, err error) {
					if err != nil {
						onError(fmt.Errorf("failed to create securevalue: %w", err))
						return
					}

					s.outboxQueue.Append(ctx, tx, createdSecureValue, func(err error) {
						if err != nil {
							onError(fmt.Errorf("failed to append to queue: %w", err))
							return
						}

						tx.Commit(func(err error) {
							cb(createdSecureValue, err)
						})
					})
				})
			})
	})
}
