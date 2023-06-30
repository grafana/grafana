package migrations

import (
	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func addInfluxDatabaseMigration(mg *Migrator) {
	//
	//mg.AddMigration("Update uid column values in alert_notification", new(RawSQLMigration).
	//	SQLite("UPDATE alert_notification SET uid=printf('%09d',id) WHERE uid IS NULL;").
	//	Postgres("UPDATE alert_notification SET uid=lpad('' || id::text,9,'0') WHERE uid IS NULL;").
	//	Mysql("UPDATE alert_notification SET uid=lpad(id,9,'0') WHERE uid IS NULL;"))

	mg.AddMigration("Add influx database table", new(RawSQLMigration).
		SQLite(`
UPDATE data_source
SET json_data = json_set(json_data, '$.dbName', data_source.database)
WHERE data_source.type = 'influxdb'
  AND data_source.database <> ''
`).
		Postgres(`
UPDATE data_source
SET json_data = jsonb_set(json_data, '{database}', '{"dbName": ds.database}')
`).
		Mysql(`
UPDATE data_source
SET
    json_data = JSON_SET(json_data, '$.database', '{"dbName": ds.database}')
WHERE
    type = 'influxdb'
AND
    database IS NOT NULL
AND id =130
`))

}
