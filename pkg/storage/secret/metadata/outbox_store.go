package metadata

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/registry/apis/secret/assert"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/storage/secret/migrator"
)

// Implements contracts.OutboxQueue
type outboxStore struct {
	db db.DB
}

func ProvideOutboxQueue(db db.DB) contracts.OutboxQueue {
	return &outboxStore{db: db}
}

type outboxMessageDB struct {
	MessageID       string                      `xorm:"pk 'uid'"`
	MessageType     contracts.OutboxMessageType `xorm:"message_type"`
	Name            string                      `xorm:"name"`
	Namespace       string                      `xorm:"namespace"`
	EncryptedSecret string                      `xorm:"encrypted_secret"`
	KeeperName      string                      `xorm:"keeper_name"`
	ExternalID      *string                     `xorm:"external_id"`
	Created         int64                       `xorm:"created"`
}

func (*outboxMessageDB) TableName() string {
	return migrator.TableNameSecureValueOutbox
}

func (s *outboxStore) Append(ctx context.Context, input contracts.AppendOutboxMessage) (string, error) {
	assert.True(input.Type > 0, "outboxStore.Append: outbox message type is required")

	var messageID string
	err := s.db.InTransaction(ctx, func(ctx context.Context) error {
		return s.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
			outboxDB := outboxMessageDB{
				MessageID:   uuid.New().String(),
				MessageType: input.Type,
				Name:        input.Name,
				Namespace:   input.Namespace,
				KeeperName:  input.KeeperName,
				ExternalID:  input.ExternalID,
				Created:     time.Now().UTC().UnixMilli(),
			}
			if input.Type == contracts.CreateSecretOutboxMessage || input.Type == contracts.UpdateSecretOutboxMessage {
				outboxDB.EncryptedSecret = input.EncryptedSecret.DangerouslyExposeAndConsumeValue()
			}
			_, err := sess.Table(migrator.TableNameSecureValueOutbox).Insert(outboxDB)
			if err != nil {
				return fmt.Errorf("inserting message into secure value outbox table: %+w", err)
			}

			messageID = outboxDB.MessageID
			return nil
		})
	})
	return messageID, err
}

func (s *outboxStore) ReceiveN(ctx context.Context, n uint) ([]contracts.OutboxMessage, error) {
	messages := make([]contracts.OutboxMessage, 0)
	err := s.db.InTransaction(ctx, func(ctx context.Context) error {
		return s.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
			rows := make([]outboxMessageDB, 0)
			// TODO: skip locked rows
			if err := sess.Table(migrator.TableNameSecureValueOutbox).ForUpdate().OrderBy("secret_secure_value_outbox.created DESC").Limit(int(n)).Find(&rows); err != nil {
				return fmt.Errorf("fetching rows from secure value outbox table: %w", err)
			}
			for _, row := range rows {
				assert.True(row.MessageType > 0, "bug: row with no message type")
				messages = append(messages, contracts.OutboxMessage{
					Type:            row.MessageType,
					MessageID:       row.MessageID,
					Name:            row.Name,
					Namespace:       row.Namespace,
					EncryptedSecret: v0alpha1.ExposedSecureValue(row.EncryptedSecret),
					KeeperName:      row.KeeperName,
					ExternalID:      row.ExternalID,
				})
			}
			return nil
		})
	})
	return messages, err
}

func (s *outboxStore) Delete(ctx context.Context, messageID string) error {
	return s.db.InTransaction(ctx, func(ctx context.Context) error {
		return s.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
			deleted, err := sess.Delete(&outboxMessageDB{MessageID: messageID})
			if err != nil {
				return fmt.Errorf("deleting message from outbox table: messageID=%+v %w", messageID, err)
			}
			if deleted > 1 {
				return fmt.Errorf("bug: deleted more than one row from the outbox table, should delete only one at a time: deleted=%+v", deleted)
			}
			return nil
		})
	})
}
