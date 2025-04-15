package contracts

import (
	"context"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
)

type OutboxMessageType string

const (
	CreateSecretOutboxMessage OutboxMessageType = "create"
	UpdateSecretOutboxMessage OutboxMessageType = "update"
	DeleteSecretOutboxMessage OutboxMessageType = "delete"
)

type AppendOutboxMessage struct {
	Type            OutboxMessageType
	Name            string
	Namespace       string
	EncryptedSecret secretv0alpha1.ExposedSecureValue
	KeeperName      *string
	ExternalID      *string
}

type OutboxMessage struct {
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
