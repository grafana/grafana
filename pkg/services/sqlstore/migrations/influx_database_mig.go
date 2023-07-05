package migrations

import (
	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func addInfluxDatabaseMigration(mg *Migrator) {
	mg.AddMigration("Deprecate 'database' column, add to json_data", new(RawSQLMigration).
		SQLite(`
UPDATE data_source
SET json_data = json_set(json_data, '$.dbName', data_source.database)
WHERE JSON_VALID(json_data)
AND data_source.type = 'influxdb'
  AND data_source.database IS NOT NULL
  AND data_source.database <> ''
  AND (
      json_extract(json_data, '$.dbName') IS NULL
      	OR
      json_extract(json_data, '$.dbName') = ''
      );
`).
		Postgres(`
UPDATE data_source
SET json_data = jsonb_set(
        json_data::jsonb,
        '{dbName}',
        concat('"', data_source.database, '"')::jsonb
    )
WHERE data_source.type = 'influxdb'
  AND data_source.database IS NOT NULL
  AND data_source.database <> ''
  AND (
     json_data::jsonb ->> 'dbName' = ''
         OR
     json_data::jsonb ->> 'dbName' IS NULL
    )
`).
		Mysql(`
UPDATE data_source
SET json_data = JSON_SET(json_data, '$.dbName', data_source.database)
WHERE JSON_VALID(json_data)
  AND data_source.database IS NOT NULL
  AND data_source.database <> ''
  AND type = 'influxdb'
  AND (
        json_extract(json_data, '$.dbName') IS NULL
        	OR
        json_extract(json_data, '$.dbName') = ''
    );
`))
}
