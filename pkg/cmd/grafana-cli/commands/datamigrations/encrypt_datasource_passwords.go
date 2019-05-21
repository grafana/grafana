package datamigrations

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/utils"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/errutil"
)

func EncryptDatasourcePaswords(c utils.CommandLine, sqlStore *sqlstore.SqlStore) error {
	var passwordRows []map[string]string
	datasourceTypes := []string{
		"mysql",
		"influxdb",
		"elasticsearch",
		"graphite",
		"prometheus",
		"opentsdb",
	}
	return sqlStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		sess.Cols("id", "password", "secure_json_data")
		sess.Table("data_source")
		sess.In("type", datasourceTypes)
		sess.Where("password IS NOT NULL AND password != ''")
		err := sess.Find(&passwordRows)

		if err != nil {
			return errutil.Wrap("failed to select password", err)
		}

		if err := updateRows(sess, passwordRows, "password"); err != nil {
			return errutil.Wrap("failed to password updates failed", err)
		}

		var basicAuthRows []map[string]string
		sess.Cols("id", "basic_auth_password", "secure_json_data")
		sess.Table("data_source")
		sess.In("type", datasourceTypes)
		sess.Where("basic_auth_password IS NOT NULL AND basic_auth_password != ''")
		err = sess.Find(&basicAuthRows)
		if err != nil {
			return errutil.Wrap("basic_auth_password select failed", err)
		}

		if err := updateRows(sess, basicAuthRows, "basic_auth_password"); err != nil {
			return errutil.Wrap("basic_auth_password updates failed", err)
		}

		fmt.Println("Warning: Datasource provisioning files need to be manually changed to prevent overwriting of " +
			"the data during provisioning. See https://grafana.com/docs/installation/upgrading/#upgrading-to-v6-2 for " +
			"details")
		return nil
	})
}

func updateRows(session *sqlstore.DBSession, rows []map[string]string, passwordFieldName string) error {
	for _, row := range rows {
		newSecureJsonData, err := getUpdatedSecureJsonData(row, passwordFieldName)
		if err != nil {
			return err
		}

		data, err := json.Marshal(newSecureJsonData)
		if err != nil {
			return errutil.Wrap("marshaling newSecureJsonData failed", err)
		}
		newRow := map[string]interface{}{"secure_json_data": data, passwordFieldName: ""}
		session.Table("data_source")
		session.Where("id = ?", row["id"])
		// Setting both columns while having value only for secure_json_data should clear the [passwordFieldName] column
		session.Cols("secure_json_data", passwordFieldName)
		_, err = session.Update(newRow)
		if err != nil {
			return err
		}
	}
	return nil
}

func getUpdatedSecureJsonData(row map[string]string, passwordFieldName string) (map[string]interface{}, error) {
	encryptedPassword, err := util.Encrypt([]byte(row[passwordFieldName]), setting.SecretKey)
	if err != nil {
		return nil, err
	}

	var secureJsonData map[string]interface{}

	if err := json.Unmarshal([]byte(row["secure_json_data"]), &secureJsonData); err != nil {
		return nil, err
	}

	jsonFieldName := util.ToCamelCase(passwordFieldName)
	secureJsonData[jsonFieldName] = encryptedPassword
	return secureJsonData, nil
}
