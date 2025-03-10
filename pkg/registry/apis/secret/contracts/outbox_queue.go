package contracts

import (
	"context"
	"fmt"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
)

type OutboxMessageType int

const (
	CreateSecretOutboxMessage OutboxMessageType = iota
	UpdateSecretOutboxMessage
	DeleteSecretOutboxMessage
)

func (typ OutboxMessageType) String() string {
	switch typ {
	case CreateSecretOutboxMessage:
		return "CreateSecret"
	case UpdateSecretOutboxMessage:
		return "UpdateSecret"
	case DeleteSecretOutboxMessage:
		return "DeleteSecret"
	default:
		panic(fmt.Sprintf("unhandled OutboxMessageType: %d", typ))
	}
}

type OutboxMessage struct {
	Type            OutboxMessageType
	MessageID       string
	Name            string
	Namespace       string
	EncryptedSecret secretv0alpha1.ExposedSecureValue
	Keeper          string
	ExternalID      *string
}

type OutboxQueue interface {
	Append(ctx context.Context, secureValue *secretv0alpha1.SecureValue) error
	ReceiveN(ctx context.Context, n uint) ([]OutboxMessage, error)
	Delete(ctx context.Context, namespace xkube.Namespace, name string) error
}
