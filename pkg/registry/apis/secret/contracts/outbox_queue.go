package contracts

import (
	"context"
)

type contextRequestIdKey struct{}

type OutboxMessageType string

func GetRequestId(ctx context.Context) string {
	v := ctx.Value(contextRequestIdKey{})
	requestId, ok := v.(string)
	if !ok {
		return ""
	}

	return requestId
}

func ContextWithRequestID(ctx context.Context, requestId string) context.Context {
	return context.WithValue(ctx, contextRequestIdKey{}, requestId)
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
	EncryptedSecret string
	KeeperName      *string
	ExternalID      *string
}

type OutboxMessage struct {
	RequestID       string
	Type            OutboxMessageType
	MessageID       string
	Name            string
	Namespace       string
	EncryptedSecret string
	KeeperName      *string
	ExternalID      *string
	// How many times this message has been received
	ReceiveCount int
}

type OutboxQueue interface {
	// Appends a message to the outbox queue
	Append(ctx context.Context, message AppendOutboxMessage) (string, error)
	// Receives at most n messages from the outbox queue
	ReceiveN(ctx context.Context, n uint) ([]OutboxMessage, error)
	// Deletes a message from the outbox queue
	Delete(ctx context.Context, messageID string) error
	// Increments the number of times each message has been received by 1. Must be atomic.
	IncrementReceiveCount(ctx context.Context, messageIDs []string) error
}
