package metadata

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	unifiedsql "github.com/grafana/grafana/pkg/storage/unified/sql"

	"github.com/google/uuid"
	"github.com/grafana/grafana/pkg/registry/apis/secret/assert"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

type outboxStore struct {
	db      contracts.Database
	dialect sqltemplate.Dialect
}

func ProvideOutboxQueue(db contracts.Database) contracts.OutboxQueue {
	return &outboxStore{
		db:      db,
		dialect: sqltemplate.DialectForDriver(db.DriverName()),
	}
}

type outboxMessageDB struct {
	RequestID       string
	MessageID       string
	MessageType     contracts.OutboxMessageType
	Name            string
	Namespace       string
	EncryptedSecret sql.NullString
	KeeperName      sql.NullString
	ExternalID      sql.NullString
	ReceiveCount    int
	Created         int64
}

func (s *outboxStore) Append(ctx context.Context, input contracts.AppendOutboxMessage) (string, error) {
	assert.True(input.Type != "", "outboxStore.Append: outbox message type is required")

	messageID, err := s.insertMessage(ctx, input)
	if err != nil {
		return messageID, fmt.Errorf("inserting message into outbox table: %+w", err)
	}

	return messageID, nil
}

func (s *outboxStore) insertMessage(ctx context.Context, input contracts.AppendOutboxMessage) (string, error) {
	keeperName := sql.NullString{}
	if input.KeeperName != nil {
		keeperName = sql.NullString{
			Valid:  true,
			String: *input.KeeperName,
		}
	}

	externalID := sql.NullString{}
	if input.ExternalID != nil {
		externalID = sql.NullString{
			Valid:  true,
			String: *input.ExternalID,
		}
	}

	encryptedSecret := sql.NullString{}
	if input.Type == contracts.CreateSecretOutboxMessage || input.Type == contracts.UpdateSecretOutboxMessage {
		encryptedSecret = sql.NullString{
			Valid:  true,
			String: input.EncryptedSecret,
		}
	}

	messageID := uuid.New().String()

	req := appendSecureValueOutbox{
		SQLTemplate: sqltemplate.New(s.dialect),
		Row: &outboxMessageDB{
			RequestID:       input.RequestID,
			MessageID:       messageID,
			MessageType:     input.Type,
			Name:            input.Name,
			Namespace:       input.Namespace,
			EncryptedSecret: encryptedSecret,
			KeeperName:      keeperName,
			ExternalID:      externalID,
			ReceiveCount:    0,
			Created:         time.Now().UTC().UnixMilli(),
		},
	}

	query, err := sqltemplate.Execute(sqlSecureValueOutboxAppend, req)
	if err != nil {
		return messageID, fmt.Errorf("execute template %q: %w", sqlSecureValueOutboxAppend.Name(), err)
	}

	result, err := s.db.ExecContext(ctx, query, req.GetArgs()...)
	if err != nil {
		if unifiedsql.IsRowAlreadyExistsError(err) {
			return messageID, contracts.ErrSecureValueOperationInProgress
		}
		return messageID, fmt.Errorf("inserting message into secure value outbox table: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return messageID, fmt.Errorf("get rows affected: %w", err)
	}

	if rowsAffected != 1 {
		return messageID, fmt.Errorf("expected to affect 1 row, but affected %d", rowsAffected)
	}

	return messageID, nil
}

func (s *outboxStore) ReceiveN(ctx context.Context, n uint) ([]contracts.OutboxMessage, error) {
	req := receiveNSecureValueOutbox{
		SQLTemplate:  sqltemplate.New(s.dialect),
		ReceiveLimit: n,
	}

	query, err := sqltemplate.Execute(sqlSecureValueOutboxReceiveN, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", sqlSecureValueOutboxReceiveN.Name(), err)
	}

	rows, err := s.db.QueryContext(ctx, query, req.GetArgs()...)
	if err != nil {
		return nil, fmt.Errorf("fetching rows from secure value outbox table: %w", err)
	}
	defer func() { _ = rows.Close() }()

	messages := make([]contracts.OutboxMessage, 0)

	for rows.Next() {
		var row outboxMessageDB
		if err := rows.Scan(
			&row.RequestID,
			&row.MessageID,
			&row.MessageType,
			&row.Name,
			&row.Namespace,
			&row.EncryptedSecret,
			&row.KeeperName,
			&row.ExternalID,
			&row.ReceiveCount,
			&row.Created,
		); err != nil {
			return nil, fmt.Errorf("scanning row from secure value outbox table: %w", err)
		}

		var keeperName *string
		if row.KeeperName.Valid {
			keeperName = &row.KeeperName.String
		}

		var externalID *string
		if row.ExternalID.Valid {
			externalID = &row.ExternalID.String
		}

		msg := contracts.OutboxMessage{
			RequestID:    row.RequestID,
			Type:         row.MessageType,
			MessageID:    row.MessageID,
			Name:         row.Name,
			Namespace:    row.Namespace,
			KeeperName:   keeperName,
			ExternalID:   externalID,
			ReceiveCount: row.ReceiveCount,
		}

		if row.MessageType != contracts.DeleteSecretOutboxMessage && row.EncryptedSecret.Valid {
			msg.EncryptedSecret = row.EncryptedSecret.String
		}

		messages = append(messages, msg)
	}

	if err := rows.Err(); err != nil {
		return messages, fmt.Errorf("reading rows: %w", err)
	}

	return messages, nil
}

func (s *outboxStore) Delete(ctx context.Context, messageID string) error {
	assert.True(messageID != "", "outboxStore.Delete: messageID is required")

	if err := s.deleteMessage(ctx, messageID); err != nil {
		return fmt.Errorf("deleting message from outbox table %+w", err)
	}

	return nil
}

func (s *outboxStore) deleteMessage(ctx context.Context, messageID string) error {
	req := deleteSecureValueOutbox{
		SQLTemplate: sqltemplate.New(s.dialect),
		MessageID:   messageID,
	}

	query, err := sqltemplate.Execute(sqlSecureValueOutboxDelete, req)
	if err != nil {
		return fmt.Errorf("execute template %q: %w", sqlSecureValueOutboxDelete.Name(), err)
	}

	result, err := s.db.ExecContext(ctx, query, req.GetArgs()...)
	if err != nil {
		return fmt.Errorf("deleting message id=%v from secure value outbox table: %w", messageID, err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("get rows affected: %w", err)
	}

	if rowsAffected > 1 {
		return fmt.Errorf("bug: deleted more than one row from the outbox table, should delete only one at a time: deleted=%v", rowsAffected)
	}

	return nil
}

func (s *outboxStore) IncrementReceiveCount(ctx context.Context, messageIDs []string) error {
	if len(messageIDs) == 0 {
		return nil
	}

	req := incrementReceiveCountOutbox{
		SQLTemplate: sqltemplate.New(s.dialect),
		MessageIDs:  messageIDs,
	}
	query, err := sqltemplate.Execute(sqlSecureValueOutboxUpdateReceiveCount, req)
	if err != nil {
		return fmt.Errorf("execute template %q: %w", sqlSecureValueOutboxUpdateReceiveCount.Name(), err)
	}

	_, err = s.db.ExecContext(ctx, query, req.GetArgs()...)
	if err != nil {
		return fmt.Errorf("updating outbox messages receive count: %w", err)
	}

	return nil
}
