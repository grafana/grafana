package metadata

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/db"
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
	KeeperType      contracts.KeeperType        `xorm:"keeper_type"`
	Created         int64                       `xorm:"created"`
}

func (*outboxMessageDB) TableName() string {
	return migrator.TableNameSecureValueOutbox
}

func (s *outboxStore) Append(ctx context.Context, input contracts.AppendOutboxMessage) (string, error) {
	var messageID string
	err := s.db.InTransaction(ctx, func(ctx context.Context) error {
		return s.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
			outboxDB := outboxMessageDB{
				MessageID:       uuid.New().String(),
				MessageType:     input.Type,
				Name:            input.Name,
				Namespace:       input.Namespace,
				EncryptedSecret: input.EncryptedSecret.DangerouslyExposeAndConsumeValue(),
				KeeperType:      input.KeeperType,
				Created:         time.Now().UTC().UnixMilli(),
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
			if err := sess.Table(migrator.TableNameSecureValueOutbox).ForUpdate().Limit(int(n)).Find(&rows); err != nil {
				return fmt.Errorf("fetching rows from secure value outbox table: %w", err)
			}
			for _, row := range rows {
				messages = append(messages, contracts.OutboxMessage{
					Type:            row.MessageType,
					MessageID:       row.MessageID,
					Name:            row.Name,
					Namespace:       row.Namespace,
					EncryptedSecret: v0alpha1.ExposedSecureValue(row.EncryptedSecret),
					KeeperType:      row.KeeperType,
					// TODO: not being used
					ExternalID: nil,
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
			deleted, err := sess.Table(migrator.TableNameSecureValueOutbox).Delete(&outboxMessageDB{MessageID: messageID})
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
