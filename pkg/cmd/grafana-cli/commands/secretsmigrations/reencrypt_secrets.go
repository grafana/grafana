package secretsmigrations

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/runner"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/utils"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"xorm.io/xorm"
)

type simpleSecret struct {
	tableName       string
	columnName      string
	isBase64Encoded bool
}

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
				return err
			}
		}

		decrypted, err := secretsSrv.Decrypt(context.Background(), decoded)
		if err != nil {
			return err
		}

		encrypted, err := secretsSrv.EncryptWithDBSession(context.Background(), decrypted, secrets.WithoutScope(), sess)
		if err != nil {
			return err
		}

		encoded := string(encrypted)
		if s.isBase64Encoded {
			encoded = base64.StdEncoding.EncodeToString(encrypted)
		}

		updateSQL := fmt.Sprintf("UPDATE %s SET %s = ? WHERE id = ?", s.tableName, s.columnName)
		if _, err := sess.Exec(updateSQL, encoded, row.Id); err != nil {
			return err
		}
	}

	logger.Infof("Column %s from %s has been re-encrypted successfully\n", s.columnName, s.tableName)

	return nil
}

type jsonSecret struct {
	tableName string
}

func (s jsonSecret) reencrypt(secretsSrv *manager.SecretsService, sess *xorm.Session) error {
	var rows []struct {
		Id             int
		SecureJsonData map[string][]byte
	}

	if err := sess.Table(s.tableName).Cols("id", "secure_json_data").Find(&rows); err != nil {
		return err
	}

	for _, row := range rows {
		if len(row.SecureJsonData) == 0 {
			continue
		}

		decrypted, err := secretsSrv.DecryptJsonData(context.Background(), row.SecureJsonData)
		if err != nil {
			return err
		}

		var toUpdate struct {
			SecureJsonData map[string][]byte
		}

		toUpdate.SecureJsonData, err = secretsSrv.EncryptJsonDataWithDBSession(context.Background(), decrypted, secrets.WithoutScope(), sess)
		if err != nil {
			return err
		}

		if _, err := sess.Table(s.tableName).Where("id = ?", row.Id).Update(toUpdate); err != nil {
			return err
		}
	}

	logger.Infof("Secure json data from %s has been re-encrypted successfully\n", s.tableName)

	return nil
}

type alertingSecret struct{}

func (s alertingSecret) reencrypt(secretsSrv *manager.SecretsService, sess *xorm.Session) error {
	var results []struct {
		Id                        int
		AlertmanagerConfiguration []byte
	}

	selectSQL := "SELECT id, alertmanager_configuration FROM alert_configuration"
	if err := sess.SQL(selectSQL).Find(&results); err != nil {
		return err
	}

	for _, result := range results {
		result := result
		postableUserConfig, err := notifier.Load(result.AlertmanagerConfiguration)
		if err != nil {
			return err
		}

		for _, receiver := range postableUserConfig.AlertmanagerConfig.Receivers {
			for _, gmr := range receiver.GrafanaManagedReceivers {
				for k, v := range gmr.SecureSettings {
					decoded, err := base64.StdEncoding.DecodeString(v)
					if err != nil {
						return err
					}

					decrypted, err := secretsSrv.Decrypt(context.Background(), decoded)
					if err != nil {
						return err
					}

					reencrypted, err := secretsSrv.EncryptWithDBSession(context.Background(), decrypted, secrets.WithoutScope(), sess)
					if err != nil {
						return err
					}

					gmr.SecureSettings[k] = base64.StdEncoding.EncodeToString(reencrypted)
				}
			}
		}

		result.AlertmanagerConfiguration, err = json.Marshal(postableUserConfig)
		if err != nil {
			return err
		}

		if _, err := sess.Table("alert_configuration").Where("id = ?", result.Id).Update(&result); err != nil {
			return err
		}
	}

	logger.Info("Alerting secrets has been re-encrypted successfully\n")

	return nil
}

func ReEncryptSecrets(_ utils.CommandLine, runner runner.Runner) error {
	if !runner.SettingsProvider.IsFeatureToggleEnabled(secrets.EnvelopeEncryptionFeatureToggle) {
		logger.Warn("Envelope encryption is not enabled, quitting...")
		return nil
	}

	toMigrate := []interface {
		reencrypt(*manager.SecretsService, *xorm.Session) error
	}{
		simpleSecret{tableName: "dashboard_snapshot", columnName: "dashboard_encrypted", isBase64Encoded: false},
		simpleSecret{tableName: "user_auth", columnName: "o_auth_access_token", isBase64Encoded: true},
		simpleSecret{tableName: "user_auth", columnName: "o_auth_refresh_token", isBase64Encoded: true},
		simpleSecret{tableName: "user_auth", columnName: "o_auth_token_type", isBase64Encoded: true},
		jsonSecret{tableName: "data_source"},
		jsonSecret{tableName: "plugin_setting"},
		alertingSecret{},
	}

	return runner.SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		for _, m := range toMigrate {
			if err := m.reencrypt(runner.SecretsService, sess.Session); err != nil {
				return err
			}
		}

		return nil
	})
}
