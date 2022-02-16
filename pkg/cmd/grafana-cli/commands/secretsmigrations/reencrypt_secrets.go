package secretsmigrations

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/runner"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/services"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/utils"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"xorm.io/xorm"
)

func (s simpleSecret) reencrypt(secretsSrv *manager.SecretsService, sess *xorm.Session) error {
	var rows []struct {
		Id     int
		Secret string
	}

	if err := sess.Table(s.tableName).Select(fmt.Sprintf("id, %s as secret", s.columnName)).Find(&rows); err != nil {
		return err
	}

	for _, row := range rows {
		if len(row.Secret) == 0 {
			continue
		}

		var (
			err     error
			decoded = []byte(row.Secret)
		)

		if s.isBase64Encoded {
			decoded, err = base64.StdEncoding.DecodeString(row.Secret)
			if err != nil {
				services.Logger.Warnf("Could not decode base64-encoded secret (%s with id: %d) while re-encrypting it: %s", s.tableName, row.Id, err)
				continue
			}
		}

		decrypted, err := secretsSrv.Decrypt(context.Background(), decoded)
		if err != nil {
			services.Logger.Warnf("Could not decrypt secret (%s with id: %d) while re-encrypting it: %s", s.tableName, row.Id, err)
			continue
		}

		encrypted, err := secretsSrv.EncryptWithDBSession(context.Background(), decrypted, secrets.WithoutScope(), sess)
		if err != nil {
			services.Logger.Warnf("Could not decrypt secret (%s with id: %d) while re-encrypting it: %s", s.tableName, row.Id, err)
			continue
		}

		encoded := string(encrypted)
		if s.isBase64Encoded {
			encoded = base64.StdEncoding.EncodeToString(encrypted)
		}

		if s.hasUpdatedCol {
			updateSQL := fmt.Sprintf("UPDATE %s SET %s = ?, updated = ? WHERE id = ?", s.tableName, s.columnName)
			_, err = sess.Exec(updateSQL, encoded, nowInUTC(), row.Id)
		} else {
			updateSQL := fmt.Sprintf("UPDATE %s SET %s = ? WHERE id = ?", s.tableName, s.columnName)
			_, err = sess.Exec(updateSQL, encoded, row.Id)
		}

		if err != nil {
			services.Logger.Warnf("Could not update secret (%s with id: %d) while re-encrypting it: %s", s.tableName, row.Id, err)
			continue
		}
	}

	services.Logger.Infof("Column %s from %s has been re-encrypted successfully", s.columnName, s.tableName)

	return nil
}

func (s jsonSecret) reencrypt(secretsSrv *manager.SecretsService, sess *xorm.Session) error {
	var rows []struct {
		Id             int
		SecureJsonData map[string][]byte
	}

	if err := sess.Table(s.tableName).Cols("id", "secure_json_data").Find(&rows); err != nil {
		services.Logger.Warnf("Could not find any %s secret to re-encrypt", s.tableName)
		return nil
	}

	for _, row := range rows {
		if len(row.SecureJsonData) == 0 {
			continue
		}

		decrypted, err := secretsSrv.DecryptJsonData(context.Background(), row.SecureJsonData)
		if err != nil {
			services.Logger.Warnf("Could not decrypt %s secrets (id: %d) while re-encrypting them: %s", s.tableName, row.Id, err)
			continue
		}

		toUpdate := struct {
			SecureJsonData map[string][]byte
			Updated        string
		}{Updated: nowInUTC()}

		toUpdate.SecureJsonData, err = secretsSrv.EncryptJsonDataWithDBSession(context.Background(), decrypted, secrets.WithoutScope(), sess)
		if err != nil {
			services.Logger.Warnf("Could not re-encrypt %s secrets (id: %d): %s", s.tableName, row.Id, err)
			continue
		}

		if _, err := sess.Table(s.tableName).Where("id = ?", row.Id).Update(toUpdate); err != nil {
			services.Logger.Warnf("Could not update %s secrets (id: %d) while re-encrypting them: %s", s.tableName, row.Id, err)
			continue
		}
	}

	services.Logger.Infof("Secure json data secrets from %s have been re-encrypted successfully", s.tableName)

	return nil
}

func (s alertingSecret) reencrypt(secretsSrv *manager.SecretsService, sess *xorm.Session) error {
	var results []struct {
		Id                        int
		AlertmanagerConfiguration string
	}

	selectSQL := "SELECT id, alertmanager_configuration FROM alert_configuration"
	if err := sess.SQL(selectSQL).Find(&results); err != nil {
		services.Logger.Warn("Could not find any alert_configuration secret to re-encrypt")
		return nil
	}

	for _, result := range results {
		result := result
		postableUserConfig, err := notifier.Load([]byte(result.AlertmanagerConfiguration))
		if err != nil {
			services.Logger.Warnf(
				"Could not load configuration (alert_configuration with id: %d) while re-encrypting it: %s",
				result.Id, err,
			)
			continue
		}

		for _, receiver := range postableUserConfig.AlertmanagerConfig.Receivers {
			for _, gmr := range receiver.GrafanaManagedReceivers {
				for k, v := range gmr.SecureSettings {
					decoded, err := base64.StdEncoding.DecodeString(v)
					if err != nil {
						services.Logger.Warnf(
							"Could not decode base64-encoded secret (alert_configuration with id: %d, key: %s): %s",
							k, result.Id, err,
						)
						continue
					}

					decrypted, err := secretsSrv.Decrypt(context.Background(), decoded)
					if err != nil {
						services.Logger.Warnf(
							"Could not decrypt secret (alert_configuration with id: %d, key: %s): %s",
							k, result.Id, err,
						)
						continue
					}

					reencrypted, err := secretsSrv.EncryptWithDBSession(context.Background(), decrypted, secrets.WithoutScope(), sess)
					if err != nil {
						services.Logger.Warnf(
							"Could not re-encrypt secret (alert_configuration with id: %d, key: %s): %s",
							k, result.Id, err,
						)
						continue
					}

					gmr.SecureSettings[k] = base64.StdEncoding.EncodeToString(reencrypted)
				}
			}
		}

		marshalled, err := json.Marshal(postableUserConfig)
		if err != nil {
			services.Logger.Warnf(
				"Could not marshal configuration (alert_configuration with id: %d) while re-encrypting it: %s",
				result.Id, err,
			)
			continue
		}

		result.AlertmanagerConfiguration = string(marshalled)
		if _, err := sess.Table("alert_configuration").Where("id = ?", result.Id).Update(&result); err != nil {
			services.Logger.Warnf(
				"Could not update secret (alert_configuration with id: %d) while re-encrypting it: %s",
				result.Id, err,
			)
			continue
		}
	}

	services.Logger.Info("Alerting configuration secrets has been re-encrypted successfully")

	return nil
}

func nowInUTC() string {
	return time.Now().UTC().Format("2006-01-02 15:04:05")
}

func ReEncryptSecrets(_ utils.CommandLine, runner runner.Runner) error {
	if !runner.Features.IsEnabled(featuremgmt.FlagEnvelopeEncryption) {
		services.Logger.Warn("Envelope encryption is not enabled, quitting...")
		return nil
	}

	toMigrate := []interface {
		reencrypt(*manager.SecretsService, *xorm.Session) error
	}{
		simpleSecret{tableName: "dashboard_snapshot", columnName: "dashboard_encrypted", hasUpdatedCol: true},
		simpleSecret{tableName: "user_auth", columnName: "o_auth_access_token", isBase64Encoded: true},
		simpleSecret{tableName: "user_auth", columnName: "o_auth_refresh_token", isBase64Encoded: true},
		simpleSecret{tableName: "user_auth", columnName: "o_auth_token_type", isBase64Encoded: true},
		jsonSecret{tableName: "data_source"},
		jsonSecret{tableName: "plugin_setting"},
		alertingSecret{},
	}

	return runner.SQLStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		for _, m := range toMigrate {
			if err := m.reencrypt(runner.SecretsService, sess.Session); err != nil {
				services.Logger.Errorf("Secrets re-encryption failed: %s, rolling back transaction...", err)
				return err
			}
		}

		return nil
	})
}
