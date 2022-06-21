package secretsmigrations

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/runner"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/utils"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func (s simpleSecret) reencrypt(ctx context.Context, secretsSrv *manager.SecretsService, sqlStore *sqlstore.SQLStore) {
	var rows []struct {
		Id     int
		Secret []byte
	}

	if err := sqlStore.NewSession(ctx).Table(s.tableName).Select(fmt.Sprintf("id, %s as secret", s.columnName)).Find(&rows); err != nil {
		logger.Warn("Could not find any secret to re-encrypt", "table", s.tableName)
		return
	}

	var anyFailure bool

	for _, row := range rows {
		if len(row.Secret) == 0 {
			continue
		}

		err := sqlStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
			decrypted, err := secretsSrv.Decrypt(ctx, row.Secret)
			if err != nil {
				logger.Warn("Could not decrypt secret while re-encrypting it", "table", s.tableName, "id", row.Id, "error", err)
				return err
			}

			encrypted, err := secretsSrv.EncryptWithDBSession(ctx, decrypted, secrets.WithoutScope(), sess.Session)
			if err != nil {
				logger.Warn("Could not encrypt secret while re-encrypting it", "table", s.tableName, "id", row.Id, "error", err)
				return err
			}

			updateSQL := fmt.Sprintf("UPDATE %s SET %s = ?, updated = ? WHERE id = ?", s.tableName, s.columnName)
			if _, err = sess.Exec(updateSQL, encrypted, nowInUTC(), row.Id); err != nil {
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
}

func (s b64Secret) reencrypt(ctx context.Context, secretsSrv *manager.SecretsService, sqlStore *sqlstore.SQLStore) {
	var rows []struct {
		Id     int
		Secret string
	}

	if err := sqlStore.NewSession(ctx).Table(s.tableName).Select(fmt.Sprintf("id, %s as secret", s.columnName)).Find(&rows); err != nil {
		logger.Warn("Could not find any secret to re-encrypt", "table", s.tableName)
		return
	}

	var anyFailure bool

	for _, row := range rows {
		if len(row.Secret) == 0 {
			continue
		}

		err := sqlStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
			decoded, err := s.encoding.DecodeString(row.Secret)
			if err != nil {
				logger.Warn("Could not decode base64-encoded secret while re-encrypting it", "table", s.tableName, "id", row.Id, "error", err)
				return err
			}

			decrypted, err := secretsSrv.Decrypt(ctx, decoded)
			if err != nil {
				logger.Warn("Could not decrypt secret while re-encrypting it", "table", s.tableName, "id", row.Id, "error", err)
				return err
			}

			encrypted, err := secretsSrv.EncryptWithDBSession(ctx, decrypted, secrets.WithoutScope(), sess.Session)
			if err != nil {
				logger.Warn("Could not encrypt secret while re-encrypting it", "table", s.tableName, "id", row.Id, "error", err)
				return err
			}

			encoded := s.encoding.EncodeToString(encrypted)
			if s.hasUpdatedColumn {
				updateSQL := fmt.Sprintf("UPDATE %s SET %s = ?, updated = ? WHERE id = ?", s.tableName, s.columnName)
				_, err = sess.Exec(updateSQL, encoded, nowInUTC(), row.Id)
			} else {
				updateSQL := fmt.Sprintf("UPDATE %s SET %s = ? WHERE id = ?", s.tableName, s.columnName)
				_, err = sess.Exec(updateSQL, encoded, row.Id)
			}

			if err != nil {
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
}

func (s jsonSecret) reencrypt(ctx context.Context, secretsSrv *manager.SecretsService, sqlStore *sqlstore.SQLStore) {
	var rows []struct {
		Id             int
		SecureJsonData map[string][]byte
	}

	if err := sqlStore.NewSession(ctx).Table(s.tableName).Cols("id", "secure_json_data").Find(&rows); err != nil {
		logger.Warn("Could not find any secret to re-encrypt", "table", s.tableName)
		return
	}

	var anyFailure bool

	for _, row := range rows {
		if len(row.SecureJsonData) == 0 {
			continue
		}

		err := sqlStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
			decrypted, err := secretsSrv.DecryptJsonData(ctx, row.SecureJsonData)
			if err != nil {
				logger.Warn("Could not decrypt secrets while re-encrypting them", "table", s.tableName, "id", row.Id, "error", err)
				return err
			}

			toUpdate := struct {
				SecureJsonData map[string][]byte
				Updated        string
			}{Updated: nowInUTC()}

			toUpdate.SecureJsonData, err = secretsSrv.EncryptJsonDataWithDBSession(ctx, decrypted, secrets.WithoutScope(), sess.Session)
			if err != nil {
				logger.Warn("Could not re-encrypt secrets", "table", s.tableName, "id", row.Id, "error", err)
				return err
			}

			if _, err := sess.Table(s.tableName).Where("id = ?", row.Id).Update(toUpdate); err != nil {
				logger.Warn("Could not update secrets while re-encrypting them", "table", s.tableName, "id", row.Id, "error", err)
				return err
			}

			return nil
		})

		if err != nil {
			anyFailure = true
		}
	}

	if anyFailure {
		logger.Warn(fmt.Sprintf("Secure json data secrets from %s have been re-encrypted with errors", s.tableName))
	} else {
		logger.Info(fmt.Sprintf("Secure json data secrets from %s have been re-encrypted successfully", s.tableName))
	}
}

func (s alertingSecret) reencrypt(ctx context.Context, secretsSrv *manager.SecretsService, sqlStore *sqlstore.SQLStore) {
	var results []struct {
		Id                        int
		AlertmanagerConfiguration string
	}

	selectSQL := "SELECT id, alertmanager_configuration FROM alert_configuration"
	if err := sqlStore.NewSession(ctx).SQL(selectSQL).Find(&results); err != nil {
		logger.Warn("Could not find any alert_configuration secret to re-encrypt")
		return
	}

	var anyFailure bool

	for _, result := range results {
		result := result

		err := sqlStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
			postableUserConfig, err := notifier.Load([]byte(result.AlertmanagerConfiguration))
			if err != nil {
				logger.Warn("Could not load alert_configuration while re-encrypting it", "id", result.Id, "error", err)
				return err
			}

			for _, receiver := range postableUserConfig.AlertmanagerConfig.Receivers {
				for _, gmr := range receiver.GrafanaManagedReceivers {
					for k, v := range gmr.SecureSettings {
						decoded, err := base64.StdEncoding.DecodeString(v)
						if err != nil {
							logger.Warn("Could not decode base64-encoded alert_configuration secret", "id", result.Id, "key", k, "error", err)
							return err
						}

						decrypted, err := secretsSrv.Decrypt(ctx, decoded)
						if err != nil {
							logger.Warn("Could not decrypt alert_configuration secret", "id", result.Id, "key", k, "error", err)
							return err
						}

						reencrypted, err := secretsSrv.EncryptWithDBSession(ctx, decrypted, secrets.WithoutScope(), sess.Session)
						if err != nil {
							logger.Warn("Could not re-encrypt alert_configuration secret", "id", result.Id, "key", k, "error", err)
							return err
						}

						gmr.SecureSettings[k] = base64.StdEncoding.EncodeToString(reencrypted)
					}
				}
			}

			marshalled, err := json.Marshal(postableUserConfig)
			if err != nil {
				logger.Warn("Could not marshal alert_configuration while re-encrypting it", "id", result.Id, "error", err)
				return err
			}

			result.AlertmanagerConfiguration = string(marshalled)
			if _, err := sess.Table("alert_configuration").Where("id = ?", result.Id).Update(&result); err != nil {
				logger.Warn("Could not update alert_configuration secret while re-encrypting it", "id", result.Id, "error", err)
				return err
			}

			return nil
		})

		if err != nil {
			anyFailure = true
		}
	}

	if anyFailure {
		logger.Warn("Alerting configuration secrets have been re-encrypted with errors")
	} else {
		logger.Info("Alerting configuration secrets have been re-encrypted successfully")
	}
}

func ReEncryptSecrets(_ utils.CommandLine, runner runner.Runner) error {
	if runner.Features.IsEnabled(featuremgmt.FlagDisableEnvelopeEncryption) {
		logger.Warn("Envelope encryption is not enabled, quitting...")
		return nil
	}

	toMigrate := []interface {
		reencrypt(context.Context, *manager.SecretsService, *sqlstore.SQLStore)
	}{
		simpleSecret{tableName: "dashboard_snapshot", columnName: "dashboard_encrypted"},
		b64Secret{simpleSecret: simpleSecret{tableName: "user_auth", columnName: "o_auth_access_token"}, encoding: base64.StdEncoding},
		b64Secret{simpleSecret: simpleSecret{tableName: "user_auth", columnName: "o_auth_refresh_token"}, encoding: base64.StdEncoding},
		b64Secret{simpleSecret: simpleSecret{tableName: "user_auth", columnName: "o_auth_token_type"}, encoding: base64.StdEncoding},
		b64Secret{simpleSecret: simpleSecret{tableName: "secrets", columnName: "value"}, hasUpdatedColumn: true, encoding: base64.RawStdEncoding},
		jsonSecret{tableName: "data_source"},
		jsonSecret{tableName: "plugin_setting"},
		alertingSecret{},
	}

	for _, m := range toMigrate {
		m.reencrypt(context.Background(), runner.SecretsService, runner.SQLStore)
	}

	return nil
}
