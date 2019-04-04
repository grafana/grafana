package migrations

import (
	"encoding/json"
	"fmt"
	"github.com/go-xorm/xorm"
	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

type AddEncryptPasswordsMigration struct {
	MigrationBase
}

func (m *AddEncryptPasswordsMigration) Sql(dialect Dialect) string {
	return "code migration"
}

func (m *AddEncryptPasswordsMigration) Exec(sess *xorm.Session, mg *Migrator) error {
	var passwordRows []map[string]string
	datasourceTypes := []string{
		"mysql",
		"influxdb",
		"elasticsearch",
		"graphite",
		"prometheus",
		"opentsdb",
	}

	sess.Cols("id", "password", "secure_json_data")
	sess.Table("data_source")
	sess.In("type", datasourceTypes)
	sess.Where("password IS NOT NULL")
	err := sess.Find(&passwordRows)
	if err != nil {
		return fmt.Errorf("password select failed: %v", err)
	}

	if err := updateRows(sess, passwordRows, "password"); err != nil {
		return fmt.Errorf("password updates failed: %v", err)
	}

	var basicAuthRows []map[string]string
	sess.Cols("id", "basic_auth_password", "secure_json_data")
	sess.Table("data_source")
	sess.In("type", datasourceTypes)
	sess.Where("basic_auth_password IS NOT NULL")
	err = sess.Find(&basicAuthRows)
	if err != nil {
		return fmt.Errorf("basic_auth_password select failed: %v", err)
	}

	if err := updateRows(sess, basicAuthRows, "basic_auth_password"); err != nil {
		return fmt.Errorf("basic_auth_password updates failed: %v", err)
	}

	return nil
}

// addEncryptPasswordsMigration will move unencrypted passwords from password and basic_auth_password fields into
// secure_json_data and encrypt them. This is done only for some core datasources that did not use the encrypted storage
// until now.
func addEncryptPasswordsMigration(mg *Migrator) {
	mg.AddMigration("Encrypt datasource password", &AddEncryptPasswordsMigration{})
}

func updateRows(session *xorm.Session, rows []map[string]string, passwordFieldName string) error {
	for _, row := range rows {
		newSecureJsonData, err := getUpdatedSecureJsonData(row, passwordFieldName)
		if err != nil {
			return err
		}

		data, err := json.Marshal(newSecureJsonData)
		if err != nil {
			return fmt.Errorf("marshaling newSecureJsonData failed: %v", err)
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
