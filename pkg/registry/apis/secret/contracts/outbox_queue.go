package contracts

import (
	"context"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
)

type OutboxMessage struct {
	MessageID       string
	Name            string
	Namespace       string
	EncryptedSecret string
	Keeper          string
	ExternalID      *string
}

type OutboxQueue interface {
	Append(ctx context.Context, tx Tx, secureValue *secretv0alpha1.SecureValue, cb func(error))
	ReceiveN(ctx context.Context, tx Tx, n int, cb func(messages []OutboxMessage, err error))
	Delete(ctx context.Context, tx Tx, namespace xkube.Namespace, name string, cb func(err error))
}
