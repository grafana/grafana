package migrations

import (
	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func addLiveMigrations(mg *Migrator) {
	liveMessage := Table{
		Name: "live_message",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, Nullable: false, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: DB_BigInt, Nullable: false},
			{Name: "channel", Type: DB_NVarchar, Length: 255, Nullable: false},
			{Name: "data", Type: DB_Text, Nullable: false},
			{Name: "created_by", Type: DB_Int, Nullable: false},
			{Name: "created", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"org_id", "channel"}, Type: UniqueIndex},
		},
	}

	mg.AddMigration("create live message table", NewAddTableMigration(liveMessage))
	mg.AddMigration("add index live_message.org_id_channel_unique", NewAddIndexMigration(liveMessage, liveMessage.Indices[0]))
}
