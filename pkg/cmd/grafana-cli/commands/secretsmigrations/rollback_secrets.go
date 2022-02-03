package secretsmigrations

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana/pkg/services/featuremgmt"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/runner"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/utils"
	"github.com/grafana/grafana/pkg/services/encryption"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"xorm.io/xorm"
)

func (s simpleSecret) rollback(
	secretsSrv *manager.SecretsService,
	encryptionSrv encryption.Internal,
	sess *xorm.Session,
	secretKey string,
) error {
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

		encrypted, err := encryptionSrv.Encrypt(context.Background(), decrypted, secretKey)
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

	logger.Infof("Column %s from %s have been rolled back successfully\n", s.columnName, s.tableName)

	return nil
}

func (s jsonSecret) rollback(
	secretsSrv *manager.SecretsService,
	encryptionSrv encryption.Internal,
	sess *xorm.Session,
	secretKey string,
) error {
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

		toUpdate.SecureJsonData, err = encryptionSrv.EncryptJsonData(context.Background(), decrypted, secretKey)
		if err != nil {
			return err
		}

		if _, err := sess.Table(s.tableName).Where("id = ?", row.Id).Update(toUpdate); err != nil {
			return err
		}
	}

	logger.Infof("Secure json data from %s have been rolled back successfully\n", s.tableName)

	return nil
}

func (s alertingSecret) rollback(
	secretsSrv *manager.SecretsService,
	encryptionSrv encryption.Internal,
	sess *xorm.Session,
	secretKey string,
) error {
	var results []struct {
		Id                        int
		AlertmanagerConfiguration string
	}

	selectSQL := "SELECT id, alertmanager_configuration FROM alert_configuration"
	if err := sess.SQL(selectSQL).Find(&results); err != nil {
		return err
	}

	for _, result := range results {
		result := result
		postableUserConfig, err := notifier.Load([]byte(result.AlertmanagerConfiguration))
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

					reencrypted, err := encryptionSrv.Encrypt(context.Background(), decrypted, secretKey)
					if err != nil {
						return err
					}

					gmr.SecureSettings[k] = base64.StdEncoding.EncodeToString(reencrypted)
				}
			}
		}

		marshalled, err := json.Marshal(postableUserConfig)
		if err != nil {
			return err
		}

		result.AlertmanagerConfiguration = string(marshalled)
		if _, err := sess.Table("alert_configuration").Where("id = ?", result.Id).Update(&result); err != nil {
			return err
		}
	}

	logger.Info("Alerting secrets have rolled re-encrypted successfully\n")

	return nil
}

func RollBackSecrets(_ utils.CommandLine, runner runner.Runner) error {
	if !runner.Features.IsEnabled(featuremgmt.FlagEnvelopeEncryption) {
		logger.Warn("Envelope encryption is not enabled, quitting...")
		return nil
	}

	toMigrate := []interface {
		rollback(*manager.SecretsService, encryption.Internal, *xorm.Session, string) error
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
			if err := m.rollback(
				runner.SecretsService,
				runner.EncryptionService,
				sess.Session,
				runner.Cfg.SecretKey); err != nil {
				return err
			}
		}

		if _, err := sess.Exec("DELETE FROM data_keys"); err != nil {
			logger.Warn("Error while cleaning up data keys table...", "err", err)
		}

		return nil
	})
}
