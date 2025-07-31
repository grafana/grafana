package datamigrations

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/fatih/color"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/utils"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

var datasourceTypes = []string{
	"mysql",
	"influxdb",
	"elasticsearch",
	"graphite",
	"prometheus",
	"opentsdb",
}

// EncryptDatasourcePasswords migrates unencrypted secrets on datasources
// to the secureJson Column.
func EncryptDatasourcePasswords(c utils.CommandLine, settingsProvider setting.SettingsProvider, sqlStore db.DB) error {
	cfg := settingsProvider.Get()
	return sqlStore.WithDbSession(context.Background(), func(session *db.Session) error {
		passwordsUpdated, err := migrateColumn(cfg, session, "password")
		if err != nil {
			return err
		}

		basicAuthUpdated, err := migrateColumn(cfg, session, "basic_auth_password")
		if err != nil {
			return err
		}

		logger.Info("\n")
		if passwordsUpdated > 0 {
			logger.Infof("%s Encrypted password field for %d datasources \n", color.GreenString("✔"), passwordsUpdated)
		}

		if basicAuthUpdated > 0 {
			logger.Infof("%s Encrypted basic_auth_password field for %d datasources \n", color.GreenString("✔"), basicAuthUpdated)
		}

		if passwordsUpdated == 0 && basicAuthUpdated == 0 {
			logger.Infof("%s All datasources secrets are already encrypted\n", color.GreenString("✔"))
		}

		logger.Info("\n")

		logger.Warn("Warning: Datasource provisioning files need to be manually changed to prevent overwriting of " +
			"the data during provisioning. See https://grafana.com/docs/installation/upgrading/#upgrading-to-v6-2 for " +
			"details")
		return nil
	})
}

func migrateColumn(cfg *setting.Cfg, session *db.Session, column string) (int, error) {
	var rows []map[string][]byte

	session.Cols("id", column, "secure_json_data")
	session.Table("data_source")
	session.In("type", datasourceTypes)
	session.Where(column + " IS NOT NULL AND " + column + " != ''")
	err := session.Find(&rows)
	if err != nil {
		return 0, fmt.Errorf("failed to select column: %s: %w", column, err)
	}

	rowsUpdated, err := updateRows(cfg, session, rows, column)
	if err != nil {
		return rowsUpdated, fmt.Errorf("failed to update column: %s: %w", column, err)
	}
	return rowsUpdated, err
}

func updateRows(cfg *setting.Cfg, session *db.Session, rows []map[string][]byte, passwordFieldName string) (int, error) {
	var rowsUpdated int

	for _, row := range rows {
		newSecureJSONData, err := getUpdatedSecureJSONData(cfg.SecretKey, row, passwordFieldName)
		if err != nil {
			return 0, err
		}

		data, err := json.Marshal(newSecureJSONData)
		if err != nil {
			return 0, fmt.Errorf("%v: %w", "marshaling newSecureJsonData failed", err)
		}

		newRow := map[string]any{"secure_json_data": data, passwordFieldName: ""}
		session.Table("data_source")
		session.Where("id = ?", string(row["id"]))
		// Setting both columns while having value only for secure_json_data should clear the [passwordFieldName] column
		session.Cols("secure_json_data", passwordFieldName)

		_, err = session.Update(newRow)
		if err != nil {
			return 0, err
		}

		rowsUpdated++
	}
	return rowsUpdated, nil
}

func getUpdatedSecureJSONData(secretKey string, row map[string][]byte, passwordFieldName string) (map[string]any, error) {
	encryptedPassword, err := util.Encrypt(row[passwordFieldName], secretKey)
	if err != nil {
		return nil, err
	}

	var secureJSONData map[string]any

	if len(row["secure_json_data"]) > 0 {
		if err := json.Unmarshal(row["secure_json_data"], &secureJSONData); err != nil {
			return nil, err
		}
	} else {
		secureJSONData = map[string]any{}
	}

	jsonFieldName := util.ToCamelCase(passwordFieldName)
	secureJSONData[jsonFieldName] = encryptedPassword
	return secureJSONData, nil
}
