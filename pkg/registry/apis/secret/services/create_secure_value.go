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
	transactionManager         contracts.TransactionManager
	secureValueMetadataStorage contracts.SecureValueMetadataStorage
	outboxQueue                contracts.OutboxQueue
}

func NewCreateSecureValue(
	tx contracts.TransactionManager,
	secureValueMetadataStorage contracts.SecureValueMetadataStorage,
	outboxQueue contracts.OutboxQueue,
) *CreateSecureValue {
	return &CreateSecureValue{tx, secureValueMetadataStorage, outboxQueue}
}

func (s *CreateSecureValue) Handle(ctx context.Context, sv *secretv0alpha1.SecureValue) (runtime.Object, error) {
	// Modified inside the transaction callback.
	var object runtime.Object

	err := s.transactionManager.InTransaction(ctx, func(ctx context.Context) error {
		isPending, err := s.secureValueMetadataStorage.SecretMetadataHasPendingStatus(ctx, xkube.Namespace(sv.Namespace), sv.Name)
		if err != nil {
			return fmt.Errorf("failed to create secure value: %w", err)
		}

		if isPending {
			return fmt.Errorf("already pending")
		}

		// TODO: Consume sv.rawSecret and encrypt value here before storing!
		// TODO: handle REF vs VALUE
		_ = sv.Spec.Value.DangerouslyExposeAndConsumeValue()

		createdSecureValue, err := s.secureValueMetadataStorage.Create(ctx, sv)
		if err != nil {
			return fmt.Errorf("failed to create securevalue: %w", err)
		}

		object = createdSecureValue

		if err := s.outboxQueue.Append(ctx, createdSecureValue); err != nil {
			return fmt.Errorf("failed to append to queue: %w", err)
		}

		return nil
	})

	return object, err
}
