package migrations

import . "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addEntityEventsTableMigration(mg *Migrator) {
	entityEventsTable := Table{
		Name: "entity_event",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, Nullable: false, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "grn", Type: DB_NVarchar, Length: 1024, Nullable: false},
			{Name: "event_type", Type: DB_NVarchar, Length: 64, Nullable: false},
			{Name: "created", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{},
	}

	mg.AddMigration("create entity_event table", NewAddTableMigration(entityEventsTable))

	mg.AddMigration("Update entity_event triggers dashboard", NewRawSQLMigration("").
		SQLite(`
drop trigger entity_event_dash_save;
CREATE TRIGGER entity_event_dash_save AFTER INSERT
    ON dashboard
BEGIN
    INSERT INTO entity_event(grn, event_type, created) VALUES ('database/' || new.org_id || '/dashboard/' || new.uid, 'create', datetime('now'));
END;

drop trigger entity_event_dash_update;
CREATE TRIGGER entity_event_dash_update AFTER UPDATE
    ON dashboard
BEGIN
    INSERT INTO entity_event(grn, event_type, created) VALUES ('database/' || new.org_id || '/dashboard/' || new.uid, 'update', datetime('now'));
END;

drop trigger entity_event_dash_delete;
CREATE TRIGGER entity_event_dash_delete AFTER DELETE
    ON dashboard
BEGIN
    INSERT INTO entity_event(grn, event_type, created) VALUES ('database/' || old.org_id || '/dashboard/' || old.uid, 'delete', datetime('now'));
END;
`).
		Postgres("").
		Mysql(""))
}
