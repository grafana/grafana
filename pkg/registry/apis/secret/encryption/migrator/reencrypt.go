package migrator

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption/manager"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func (s simpleSecret) ReEncrypt(ctx context.Context, namespace string, secretsSrv *manager.EncryptionManager, sqlStore db.DB) bool {
	var rows []struct {
		Id     int
		Secret []byte
	}

	if err := sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
		return sess.Table(s.tableName).Select(fmt.Sprintf("id, %s as secret", s.columnName)).Find(&rows)
	}); err != nil {
		logger.Warn("Could not find any secret to re-encrypt", "table", s.tableName)
		return false
	}

	var anyFailure bool

	for _, row := range rows {
		if len(row.Secret) == 0 {
			continue
		}

		err := sqlStore.InTransaction(ctx, func(ctx context.Context) error {
			decrypted, err := secretsSrv.Decrypt(ctx, namespace, row.Secret)
			if err != nil {
				logger.Warn("Could not decrypt secret while re-encrypting it", "table", s.tableName, "id", row.Id, "error", err)
				return err
			}

			encrypted, err := secretsSrv.Encrypt(ctx, namespace, decrypted)
			if err != nil {
				logger.Warn("Could not encrypt secret while re-encrypting it", "table", s.tableName, "id", row.Id, "error", err)
				return err
			}

			updateSQL := fmt.Sprintf("UPDATE %s SET %s = ?, updated = ? WHERE id = ?", s.tableName, s.columnName)
			if err = sqlStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
				_, err := sess.Exec(updateSQL, encrypted, nowInUTC(), row.Id)
				return err
			}); err != nil {
				logger.Warn("Could not update secret while re-encrypting it", "table", s.tableName, "id", row.Id, "error", err)
				return err
			}

			return nil
		})

		if err != nil {
			anyFailure = true
		}
	}

	if anyFailure {
		logger.Warn(fmt.Sprintf("Column %s from %s has been re-encrypted with errors", s.columnName, s.tableName))
	} else {
		logger.Info(fmt.Sprintf("Column %s from %s has been re-encrypted successfully", s.columnName, s.tableName))
	}

	return !anyFailure
}
