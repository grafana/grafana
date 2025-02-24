package services

import (
	"context"
	"fmt"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"k8s.io/apimachinery/pkg/runtime"
)

type CreateSecureValue struct {
	tx                         contracts.TransactionManager
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
	s.secureValueMetadataStorage.SecretMetadataHasPendingStatus(ctx, s.tx, xkube.Namespace(sv.Namespace), sv.Name,
		func(isPending bool, err error) {
			if err != nil {
				cb(nil, fmt.Errorf("failed to create secure value: %w", err))
				return
			}

			if isPending {
				cb(nil, fmt.Errorf("already pending"))
				return
			}

			// TODO: Consume sv.rawSecret and encrypt value here before storing!
			// TODO: handle REF vs VALUE
			_ = sv.Spec.Value.DangerouslyExposeAndConsumeValue()

			// /\ db' = [db EXCEPT !.secret_metadata = @ \union {[name |-> s, status |-> "Pending"]}]
			s.secureValueMetadataStorage.Create(ctx, s.tx, sv, func(createdSecureValue *secretv0alpha1.SecureValue, err error) {
				if err != nil {
					cb(nil, fmt.Errorf("failed to create securevalue: %w", err))
					return
				}

				// 			// /\ queue' = [queue EXCEPT !.pending = Append(queue.pending, s)]
				s.outboxQueue.Append(ctx, s.tx, createdSecureValue, func(err error) {
					if err != nil {
						cb(nil, fmt.Errorf("failed to append to queue: %w", err))
						return
					}

					cb(createdSecureValue, nil)
				})
			})
		})
}
