package migrations

import (
	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func addLiveMigrations(mg *Migrator) {
	liveChannel := Table{
		Name: "live_channel",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, Nullable: false, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: DB_BigInt, Nullable: false},
			{Name: "channel", Type: DB_NVarchar, Length: 189, Nullable: false},
			{Name: "data", Type: DB_Text, Nullable: false},
			{Name: "created", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"org_id", "channel"}, Type: UniqueIndex},
		},
	}

	mg.AddMigration("create live channel table", NewAddTableMigration(liveChannel))
	mg.AddMigration("add index live_channel.org_id_channel_unique", NewAddIndexMigration(liveChannel, liveChannel.Indices[0]))
}
