package metadata

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
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
	MessageID       string
	MessageType     contracts.OutboxMessageType
	Name            string
	Namespace       string
	EncryptedSecret sql.NullString
	KeeperName      sql.NullString
	ExternalID      sql.NullString
	Created         int64
}

func (s *outboxStore) Append(ctx context.Context, input contracts.AppendOutboxMessage) (string, error) {
	assert.True(input.Type != "", "outboxStore.Append: outbox message type is required")

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
			Valid: true,
			// TODO: this type does not need to be exposed when encrypted (maybe []byte or string)
			String: input.EncryptedSecret.DangerouslyExposeAndConsumeValue(),
		}
	}

	messageID := uuid.New().String()

	req := appendSecureValueOutbox{
		SQLTemplate: sqltemplate.New(s.dialect),
		Row: &outboxMessageDB{
			MessageID:       messageID,
			MessageType:     input.Type,
			Name:            input.Name,
			Namespace:       input.Namespace,
			EncryptedSecret: encryptedSecret,
			KeeperName:      keeperName,
			ExternalID:      externalID,
			Created:         time.Now().UTC().UnixMilli(),
		},
	}

	query, err := sqltemplate.Execute(sqlSecureValueOutboxAppend, req)
	if err != nil {
		return "", fmt.Errorf("execute template %q: %w", sqlSecureValueOutboxAppend.Name(), err)
	}

	result, err := s.db.ExecContext(ctx, query, req.GetArgs()...)
	if err != nil {
		return "", fmt.Errorf("inserting message into secure value outbox table: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return "", fmt.Errorf("get rows affected: %w", err)
	}

	if rowsAffected != 1 {
		return "", fmt.Errorf("expected to affect 1 row, but affected %d", rowsAffected)
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
			&row.MessageID,
			&row.MessageType,
			&row.Name,
			&row.Namespace,
			&row.EncryptedSecret,
			&row.KeeperName,
			&row.ExternalID,
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
			Type:       row.MessageType,
			MessageID:  row.MessageID,
			Name:       row.Name,
			Namespace:  row.Namespace,
			KeeperName: keeperName,
			ExternalID: externalID,
		}

		if row.MessageType != contracts.DeleteSecretOutboxMessage && row.EncryptedSecret.Valid {
			// TODO: dont do this because it is encrypted!
			msg.EncryptedSecret = v0alpha1.ExposedSecureValue(row.EncryptedSecret.String)
		}

		messages = append(messages, msg)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating over rows: %w", err)
	}

	return messages, nil
}

func (s *outboxStore) Delete(ctx context.Context, messageID string) error {
	assert.True(messageID != "", "outboxStore.Delete: messageID is required")

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

	if rowsAffected != 1 {
		return fmt.Errorf("bug: deleted more than one row from the outbox table, should delete only one at a time: deleted=%v", rowsAffected)
	}

	return nil
}
