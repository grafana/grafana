package metadata

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	unifiedsql "github.com/grafana/grafana/pkg/storage/unified/sql"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/registry/apis/secret/assert"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

type outboxStore struct {
	db      contracts.Database
	dialect sqltemplate.Dialect
	tracer  trace.Tracer
}

func ProvideOutboxQueue(db contracts.Database, tracer trace.Tracer) contracts.OutboxQueue {
	return &outboxStore{
		db:      db,
		dialect: sqltemplate.DialectForDriver(db.DriverName()),
		tracer:  tracer,
	}
}

type outboxMessageDB struct {
	RequestID       string
	MessageID       int64
	MessageType     contracts.OutboxMessageType
	Name            string
	Namespace       string
	EncryptedSecret sql.NullString
	KeeperName      sql.NullString
	ExternalID      sql.NullString
	ReceiveCount    int
	Created         int64
}

func (s *outboxStore) Append(ctx context.Context, input contracts.AppendOutboxMessage) (messageID int64, err error) {
	ctx, span := s.tracer.Start(ctx, "outboxStore.Append", trace.WithAttributes(
		attribute.String("name", input.Name),
		attribute.String("namespace", input.Namespace),
		attribute.String("type", string(input.Type)),
		attribute.String("requestID", input.RequestID),
	))
	defer span.End()

	defer func() {
		if err != nil {
			span.SetStatus(codes.Error, "failed to append outbox message")
			span.RecordError(err)
		}

		if messageID != 0 {
			span.SetAttributes(attribute.Int64("messageID", messageID))
		}
	}()

	assert.True(input.Type != "", "outboxStore.Append: outbox message type is required")

	messageID, err = s.insertMessage(ctx, input)
	if err != nil {
		return messageID, fmt.Errorf("inserting message into outbox table: %+w", err)
	}

	return messageID, nil
}

func (s *outboxStore) insertMessage(ctx context.Context, input contracts.AppendOutboxMessage) (int64, error) {
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

	req := appendSecureValueOutbox{
		SQLTemplate: sqltemplate.New(s.dialect),
		Row: &outboxMessageDB{
			RequestID:       input.RequestID,
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
		return 0, fmt.Errorf("execute template %q: %w", sqlSecureValueOutboxAppend.Name(), err)
	}

	result, err := s.db.ExecContext(ctx, query, req.GetArgs()...)
	if err != nil {
		if unifiedsql.IsRowAlreadyExistsError(err) {
			return 0, contracts.ErrSecureValueOperationInProgress
		}
		return 0, fmt.Errorf("inserting message into secure value outbox table: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return 0, fmt.Errorf("get rows affected: %w", err)
	}

	if rowsAffected != 1 {
		return 0, fmt.Errorf("expected to affect 1 row, but affected %d", rowsAffected)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return id, fmt.Errorf("fetching last inserted id: %w", err)
	}

	return id, nil
}

func (s *outboxStore) ReceiveN(ctx context.Context, limit uint) ([]contracts.OutboxMessage, error) {
	messageIDs, err := s.fetchMessageIdsInQueue(ctx, limit)
	if err != nil {
		return nil, fmt.Errorf("fetching message ids from queue: %w", err)
	}
	// If queue is empty
	if len(messageIDs) == 0 {
		return nil, nil
	}
	req := receiveNSecureValueOutbox{
		SQLTemplate: sqltemplate.New(s.dialect),
		MessageIDs:  messageIDs,
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
			Created:      row.Created,
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

func (s *outboxStore) fetchMessageIdsInQueue(ctx context.Context, limit uint) ([]int64, error) {
	req := fetchMessageIDsOutbox{
		SQLTemplate:  sqltemplate.New(s.dialect),
		ReceiveLimit: limit,
	}

	query, err := sqltemplate.Execute(sqlSecureValueOutboxFetchMessageIDs, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", sqlSecureValueOutboxFetchMessageIDs.Name(), err)
	}

	rows, err := s.db.QueryContext(ctx, query, req.GetArgs()...)
	if err != nil {
		return nil, fmt.Errorf("fetching rows from secure value outbox table: %w", err)
	}
	defer func() { _ = rows.Close() }()

	messageIDs := make([]int64, 0, limit)

	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, fmt.Errorf("scanning row; %w", err)
		}
		messageIDs = append(messageIDs, id)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("reading rows: %w", err)
	}

	return messageIDs, nil
}

func (s *outboxStore) Delete(ctx context.Context, messageID int64) (err error) {
	ctx, span := s.tracer.Start(ctx, "outboxStore.Append", trace.WithAttributes(
		attribute.Int64("messageID", messageID),
	))
	defer span.End()

	defer func() {
		if err != nil {
			span.SetStatus(codes.Error, "failed to delete message from outbox")
			span.RecordError(err)
		}
	}()

	assert.True(messageID != 0, "outboxStore.Delete: messageID is required")

	if err := s.deleteMessage(ctx, messageID); err != nil {
		return fmt.Errorf("deleting message from outbox table %+w", err)
	}

	return nil
}

func (s *outboxStore) deleteMessage(ctx context.Context, messageID int64) error {
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

func (s *outboxStore) IncrementReceiveCount(ctx context.Context, messageIDs []int64) error {
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
