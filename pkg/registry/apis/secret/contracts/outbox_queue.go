package contracts

import (
	"context"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
)

var contextRequestIdKey = "sv_contextRequestIdKey"

type OutboxMessageType string

func GetRequestId(ctx context.Context) string {
	v := ctx.Value(contextRequestIdKey)
	requestId, ok := v.(string)
	if !ok {
		return ""
	}

	return requestId
}

func ContextWithRequestID(ctx context.Context, requestId string) context.Context {
	return context.WithValue(ctx, contextRequestIdKey, requestId)
}

const (
	CreateSecretOutboxMessage OutboxMessageType = "create"
	UpdateSecretOutboxMessage OutboxMessageType = "update"
	DeleteSecretOutboxMessage OutboxMessageType = "delete"
)

type AppendOutboxMessage struct {
	RequestID       string
	Type            OutboxMessageType
	Name            string
	Namespace       string
	EncryptedSecret secretv0alpha1.ExposedSecureValue
	KeeperName      *string
	ExternalID      *string
}

type OutboxMessage struct {
	RequestID       string
	Type            OutboxMessageType
	MessageID       string
	Name            string
	Namespace       string
	EncryptedSecret secretv0alpha1.ExposedSecureValue
	KeeperName      *string
	ExternalID      *string
}

type OutboxQueue interface {
	// Appends a message to the outbox queue
	Append(ctx context.Context, message AppendOutboxMessage) (string, error)
	// Receives at most n messages from the outbox queue
	ReceiveN(ctx context.Context, n uint) ([]OutboxMessage, error)
	// Deletes a message from the outbox queue
	Delete(ctx context.Context, messageID string) error
}
