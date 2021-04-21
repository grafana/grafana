package database

import "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func AddLiveChannelMigrations(mg *migrator.Migrator) {
	liveChannel := migrator.Table{
		Name: "live_channel",
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_BigInt, Nullable: false, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "channel", Type: migrator.DB_NVarchar, Length: 189, Nullable: false},
			{Name: "data", Type: migrator.DB_Text, Nullable: false},
			{Name: "published", Type: migrator.DB_DateTime, Nullable: true},
			{Name: "created", Type: migrator.DB_DateTime, Nullable: false},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"org_id", "channel"}, Type: migrator.UniqueIndex},
		},
	}

	mg.AddMigration("create live channel table", migrator.NewAddTableMigration(liveChannel))
	mg.AddMigration("add index live_channel.org_id_channel_unique", migrator.NewAddIndexMigration(liveChannel, liveChannel.Indices[0]))
}
