package datamigrations

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/commands/runner"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/utils"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type secretsColumn struct {
	Table string
	Name  string
}

var secretColumnsToMigrate = []secretsColumn{
	{Table: "alert_configuration", Name: "alertmanager_configuration"},
}

// MigrateSecrets migrates symmetric encrypted
// secrets into envelope encryption.
func MigrateSecrets(_ utils.CommandLine, runner runner.Runner) error {
	return runner.SQLStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		if err := migrateEncryptedColumns(runner.SecretsService, sess); err != nil {
			return err
		}

		encryptedJSONColumns := []secretsColumn{
			{Table: "alert_notification", Name: "secure_settings"},
			{Table: "data_source", Name: "secure_json_data"},
		}
		if err := migrateEncryptedJSONColumns(sess, encryptedJSONColumns); err != nil {
			return err
		}

		return nil
	})
}

func migrateEncryptedColumns(secretsSrv secrets.Service, sess *sqlstore.DBSession) error {
	cols := []secretsColumn{
		{Table: "dashboard_snapshot", Name: "dashboard_encrypted"},
		{Table: "user_auth", Name: "o_auth_access_token"},
		{Table: "user_auth", Name: "o_auth_refresh_token"},
		{Table: "user_auth", Name: "o_auth_token_type"},
		{Table: "user_auth", Name: "o_auth_token_type"},
	}

	for _, col := range cols {
		var rows []struct {
			Id     int
			Secret string
		}

		// 1. Fetch all rows with its id
		selectSQL := fmt.Sprintf("SELECT id, %s as secret FROM %s", col.Name, col.Table)
		if err := sess.SQL(selectSQL).Find(&rows); err != nil {
			return err
		}

		// 2. Re-encrypt the secret of each row
		for _, row := range rows {
			encrypted, err := migrateSecretsColumn(secretsSrv, row.Secret)
			if err != nil {
				return err
			}

			if _, err := sess.Table(col.Table).ID(selectSQL).Update(&row); err != nil {
				return err
			}

			row.Secret = encrypted
		}
	}

	return nil
}

func migrateEncryptedJSONColumns(sess *sqlstore.DBSession, cols []secretsColumn) error {
	for _, col := range cols {
		fmt.Println(col)
	}

	return nil
}

func migrateSecretsColumn(secretsSrv secrets.Service, secret string) (string, error) {
	decrypted, err := secretsSrv.Decrypt(context.Background(), []byte(secret))
	if err != nil {
		return "", err
	}

	encrypted, err := secretsSrv.Encrypt(context.Background(), decrypted, secrets.WithoutScope())
	if err != nil {
		return "", err
	}

	return string(encrypted), nil
}
