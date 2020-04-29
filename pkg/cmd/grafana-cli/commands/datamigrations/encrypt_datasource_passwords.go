package datamigrations

import (
	"context"
	"encoding/json"

	"github.com/fatih/color"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/utils"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/errutil"
)

var (
	datasourceTypes = []string{
		"mysql",
		"influxdb",
		"elasticsearch",
		"graphite",
		"prometheus",
		"opentsdb",
	}
)

// EncryptDatasourcePaswords migrates un-encrypted secrets on datasources
// to the secureJson Column.
func EncryptDatasourcePaswords(c utils.CommandLine, sqlStore *sqlstore.SqlStore) error {
	return sqlStore.WithDbSession(context.Background(), func(session *sqlstore.DBSession) error {
		passwordsUpdated, err := migrateColumn(session, "password")
		if err != nil {
			return err
		}

		basicAuthUpdated, err := migrateColumn(session, "basic_auth_password")
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

func migrateColumn(session *sqlstore.DBSession, column string) (int, error) {
	var rows []map[string][]byte

	session.Cols("id", column, "secure_json_data")
	session.Table("data_source")
	session.In("type", datasourceTypes)
	session.Where(column + " IS NOT NULL AND " + column + " != ''")
	err := session.Find(&rows)

	if err != nil {
		return 0, errutil.Wrapf(err, "failed to select column: %s", column)
	}

	rowsUpdated, err := updateRows(session, rows, column)
	return rowsUpdated, errutil.Wrapf(err, "failed to update column: %s", column)
}

func updateRows(session *sqlstore.DBSession, rows []map[string][]byte, passwordFieldName string) (int, error) {
	var rowsUpdated int

	for _, row := range rows {
		newSecureJSONData, err := getUpdatedSecureJSONData(row, passwordFieldName)
		if err != nil {
			return 0, err
		}

		data, err := json.Marshal(newSecureJSONData)
		if err != nil {
			return 0, errutil.Wrap("marshaling newSecureJsonData failed", err)
		}

		newRow := map[string]interface{}{"secure_json_data": data, passwordFieldName: ""}
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

func getUpdatedSecureJSONData(row map[string][]byte, passwordFieldName string) (map[string]interface{}, error) {
	encryptedPassword, err := util.Encrypt(row[passwordFieldName], setting.SecretKey)
	if err != nil {
		return nil, err
	}

	var secureJSONData map[string]interface{}

	if len(row["secure_json_data"]) > 0 {
		if err := json.Unmarshal(row["secure_json_data"], &secureJSONData); err != nil {
			return nil, err
		}
	} else {
		secureJSONData = map[string]interface{}{}
	}

	jsonFieldName := util.ToCamelCase(passwordFieldName)
	secureJSONData[jsonFieldName] = encryptedPassword
	return secureJSONData, nil
}
