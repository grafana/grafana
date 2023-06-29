package migrations

import "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addInfluxDatabaseMigration(mg *migrator.Migrator) {
	mg.AddMigration("Add influx database table", migrator.NewRawSQLMigration(`
UPDATE "data_source" AS ds
SET
    ds.json_data = JSON_SET(ds.json_data, '$.database', '{"dbName": ds.database}')
WHERE
    ds.type = 'influxdb'
AND
    ds.database IS NOT NULL;


`))
}

mg.AddMigration("Update uid column values in alert_notification", new(RawSQLMigration).
	SQLite("UPDATE alert_notification SET uid=printf('%09d',id) WHERE uid IS NULL;").
	Postgres("UPDATE alert_notification SET uid=lpad('' || id::text,9,'0') WHERE uid IS NULL;").
	Mysql("UPDATE alert_notification SET uid=lpad(id,9,'0') WHERE uid IS NULL;"))
