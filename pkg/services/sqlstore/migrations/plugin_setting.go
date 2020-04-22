package migrations

import (
	"fmt"
	"time"

	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func addAppSettingsMigration(mg *Migrator) {

	pluginSettingTable := Table{
		Name: "plugin_setting",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: DB_BigInt, Nullable: true},
			{Name: "plugin_id", Type: DB_NVarchar, Length: 190, Nullable: false},
			{Name: "enabled", Type: DB_Bool, Nullable: false},
			{Name: "pinned", Type: DB_Bool, Nullable: false},
			{Name: "json_data", Type: DB_Text, Nullable: true},
			{Name: "secure_json_data", Type: DB_Text, Nullable: true},
			{Name: "created", Type: DB_DateTime, Nullable: false},
			{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"org_id", "plugin_id"}, Type: UniqueIndex},
		},
	}

	mg.AddMigration("create plugin_setting table", NewAddTableMigration(pluginSettingTable))

	//-------  indexes ------------------
	addTableIndicesMigrations(mg, "v1", pluginSettingTable)

	// add column to store installed version
	mg.AddMigration("Add column plugin_version to plugin_settings", NewAddColumnMigration(pluginSettingTable, &Column{
		Name: "plugin_version", Type: DB_NVarchar, Nullable: true, Length: 50,
	}))

	mg.AddMigration("Update plugin_setting table charset", NewTableCharsetMigration("plugin_setting", []*Column{
		{Name: "plugin_id", Type: DB_NVarchar, Length: 190, Nullable: false},
		{Name: "json_data", Type: DB_Text, Nullable: true},
		{Name: "secure_json_data", Type: DB_Text, Nullable: true},
		{Name: "plugin_version", Type: DB_NVarchar, Nullable: true, Length: 50},
	}))

	manifestKeys := Table{
		Name: "manifest_keys",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "key_id", Type: DB_BigInt, Nullable: false},
			{Name: "public_key", Type: DB_Text, Nullable: false},
			{Name: "since", Type: DB_BigInt, Nullable: false},
			{Name: "revoked_at", Type: DB_BigInt, Nullable: true},
			{Name: "updated_at", Type: DB_BigInt, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"key_id"}, Type: UniqueIndex},
		},
	}

	mg.AddMigration("create manifest_keys table", NewAddTableMigration(manifestKeys))

	var defaultKeyID = `7e4d0c6a708866e7`
	var defaultPublicKey = `-----BEGIN PGP PUBLIC KEY BLOCK-----
Version: OpenPGP.js v4.10.1
Comment: https://openpgpjs.org

xpMEXpTXXxMFK4EEACMEIwQBiOUQhvGbDLvndE0fEXaR0908wXzPGFpf0P0Z
HJ06tsq+0higIYHp7WTNJVEZtcwoYLcPRGaa9OQqbUU63BEyZdgAkPTz3RFd
5+TkDWZizDcaVFhzbDd500yTwexrpIrdInwC/jrgs7Zy/15h8KA59XXUkdmT
YB6TR+OA9RKME+dCJozNGUdyYWZhbmEgPGVuZ0BncmFmYW5hLmNvbT7CvAQQ
EwoAIAUCXpTXXwYLCQcIAwIEFQgKAgQWAgEAAhkBAhsDAh4BAAoJEH5NDGpw
iGbnaWoCCQGQ3SQnCkRWrG6XrMkXOKfDTX2ow9fuoErN46BeKmLM4f1EkDZQ
Tpq3SE8+My8B5BIH3SOcBeKzi3S57JHGBdFA+wIJAYWMrJNIvw8GeXne+oUo
NzzACdvfqXAZEp/HFMQhCKfEoWGJE8d2YmwY2+3GufVRTI5lQnZOHLE8L/Vc
1S5MXESjzpcEXpTXXxIFK4EEACMEIwQBtHX/SD5Qm3v4V92qpaIZQgtTX0sT
cFPjYWAHqsQ1iENrYN/vg1wU3ADlYATvydOQYvkTyT/tbDvx2Fse8PL84MQA
YKKQ6AJ3gLVvmeouZdU03YoV4MYaT8KbnJUkZQZkqdz2riOlySNI9CG3oYmv
omjUAtzgAgnCcurfGLZkkMxlmY8DAQoJwqQEGBMKAAkFAl6U118CGwwACgkQ
fk0ManCIZuc0jAIJAVw2xdLr4ZQqPUhubrUyFcqlWoW8dQoQagwO8s8ubmby
KuLA9FWJkfuuRQr+O9gHkDVCez3aism7zmJBqIOi38aNAgjJ3bo6leSS2jR/
x5NqiKVi83tiXDPncDQYPymOnMhW0l7CVA7wj75HrFvvlRI/4MArlbsZ2tBn
N1c5v9v/4h6qeA==
=DNbR
-----END PGP PUBLIC KEY BLOCK-----
`

	mg.AddMigration(
		"insert public key into manifest)keys table",
		NewRawSqlMigration(fmt.Sprintf(`INSERT into manifest_keys (key_id, public_key, since, updated_at) VALUES ('%s', '%s', %d, %d)`,
			defaultKeyID,
			defaultPublicKey,
			time.Now().Unix(),
			time.Now().Unix())))
}
