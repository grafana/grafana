package migrations

import (
	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

// addPulseMigrations creates the schema for the Pulse feature: threaded
// conversations attached to a polymorphic resource (dashboard in v1, more
// kinds later). The migration runs unconditionally; the dashboardPulse
// feature toggle gates the routes and UI, not the schema.
func addPulseMigrations(mg *Migrator) {
	pulseThreadV1 := Table{
		Name: "pulse_thread",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "uid", Type: DB_NVarchar, Length: 40, Nullable: false},
			{Name: "org_id", Type: DB_BigInt, Nullable: false},
			{Name: "resource_kind", Type: DB_NVarchar, Length: 40, Nullable: false},
			{Name: "resource_uid", Type: DB_NVarchar, Length: 200, Nullable: false},
			// Nullable: nil means thread is attached to the resource as a whole
			// (e.g. dashboard-level), not to a specific panel within it.
			{Name: "panel_id", Type: DB_BigInt, Nullable: true},
			{Name: "title", Type: DB_NVarchar, Length: 255, Nullable: true},
			{Name: "created_by", Type: DB_BigInt, Nullable: false},
			{Name: "created", Type: DB_DateTime, Nullable: false},
			{Name: "updated", Type: DB_DateTime, Nullable: false},
			{Name: "last_pulse_at", Type: DB_DateTime, Nullable: false},
			{Name: "pulse_count", Type: DB_BigInt, Nullable: false, Default: "0"},
			{Name: "version", Type: DB_BigInt, Nullable: false, Default: "0"},
		},
		Indices: []*Index{
			{Cols: []string{"org_id", "uid"}, Type: UniqueIndex},
			{Cols: []string{"org_id", "resource_kind", "resource_uid", "last_pulse_at"}},
		},
	}
	mg.AddMigration("create pulse_thread table v1", NewAddTableMigration(pulseThreadV1))
	mg.AddMigration("add unique index pulse_thread.org_id_uid", NewAddIndexMigration(pulseThreadV1, pulseThreadV1.Indices[0]))
	mg.AddMigration("add index pulse_thread.org_resource_recent", NewAddIndexMigration(pulseThreadV1, pulseThreadV1.Indices[1]))

	pulseV1 := Table{
		Name: "pulse",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "uid", Type: DB_NVarchar, Length: 40, Nullable: false},
			{Name: "thread_uid", Type: DB_NVarchar, Length: 40, Nullable: false},
			{Name: "parent_uid", Type: DB_NVarchar, Length: 40, Nullable: true},
			{Name: "org_id", Type: DB_BigInt, Nullable: false},
			{Name: "author_user_id", Type: DB_BigInt, Nullable: false},
			{Name: "author_kind", Type: DB_NVarchar, Length: 32, Nullable: false, Default: "'user'"},
			{Name: "body_text", Type: DB_Text, Nullable: false},
			{Name: "body_json", Type: DB_Text, Nullable: false},
			{Name: "created", Type: DB_DateTime, Nullable: false},
			{Name: "updated", Type: DB_DateTime, Nullable: false},
			{Name: "edited", Type: DB_Bool, Nullable: false, Default: "0"},
			{Name: "deleted", Type: DB_Bool, Nullable: false, Default: "0"},
		},
		Indices: []*Index{
			{Cols: []string{"org_id", "uid"}, Type: UniqueIndex},
			{Cols: []string{"thread_uid", "created"}},
			{Cols: []string{"org_id", "author_user_id", "created"}},
		},
	}
	mg.AddMigration("create pulse table v1", NewAddTableMigration(pulseV1))
	mg.AddMigration("add unique index pulse.org_id_uid", NewAddIndexMigration(pulseV1, pulseV1.Indices[0]))
	mg.AddMigration("add index pulse.thread_uid_created", NewAddIndexMigration(pulseV1, pulseV1.Indices[1]))
	mg.AddMigration("add index pulse.org_author_created", NewAddIndexMigration(pulseV1, pulseV1.Indices[2]))

	pulseMentionV1 := Table{
		Name: "pulse_mention",
		Columns: []*Column{
			{Name: "pulse_uid", Type: DB_NVarchar, Length: 40, Nullable: false, IsPrimaryKey: true},
			{Name: "kind", Type: DB_NVarchar, Length: 16, Nullable: false, IsPrimaryKey: true},
			{Name: "target_id", Type: DB_NVarchar, Length: 200, Nullable: false, IsPrimaryKey: true},
			{Name: "thread_uid", Type: DB_NVarchar, Length: 40, Nullable: false},
			{Name: "org_id", Type: DB_BigInt, Nullable: false},
			{Name: "created", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"org_id", "kind", "target_id"}},
			{Cols: []string{"thread_uid"}},
		},
	}
	mg.AddMigration("create pulse_mention table v1", NewAddTableMigration(pulseMentionV1))
	mg.AddMigration("add index pulse_mention.org_kind_target", NewAddIndexMigration(pulseMentionV1, pulseMentionV1.Indices[0]))
	mg.AddMigration("add index pulse_mention.thread_uid", NewAddIndexMigration(pulseMentionV1, pulseMentionV1.Indices[1]))

	pulseSubV1 := Table{
		Name: "pulse_subscription",
		Columns: []*Column{
			{Name: "org_id", Type: DB_BigInt, IsPrimaryKey: true},
			{Name: "thread_uid", Type: DB_NVarchar, Length: 40, IsPrimaryKey: true},
			{Name: "user_id", Type: DB_BigInt, IsPrimaryKey: true},
			{Name: "subscribed_at", Type: DB_DateTime, Nullable: false},
			{Name: "mute_until", Type: DB_DateTime, Nullable: true},
		},
		Indices: []*Index{
			{Cols: []string{"thread_uid"}},
			{Cols: []string{"org_id", "user_id"}},
		},
	}
	mg.AddMigration("create pulse_subscription table v1", NewAddTableMigration(pulseSubV1))
	mg.AddMigration("add index pulse_subscription.thread_uid", NewAddIndexMigration(pulseSubV1, pulseSubV1.Indices[0]))
	mg.AddMigration("add index pulse_subscription.org_user", NewAddIndexMigration(pulseSubV1, pulseSubV1.Indices[1]))

	pulseReadV1 := Table{
		Name: "pulse_read_state",
		Columns: []*Column{
			{Name: "org_id", Type: DB_BigInt, IsPrimaryKey: true},
			{Name: "thread_uid", Type: DB_NVarchar, Length: 40, IsPrimaryKey: true},
			{Name: "user_id", Type: DB_BigInt, IsPrimaryKey: true},
			{Name: "last_read_pulse_uid", Type: DB_NVarchar, Length: 40, Nullable: false},
			{Name: "last_read_at", Type: DB_DateTime, Nullable: false},
		},
	}
	mg.AddMigration("create pulse_read_state table v1", NewAddTableMigration(pulseReadV1))
}
