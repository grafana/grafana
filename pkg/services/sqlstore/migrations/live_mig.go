package migrations

import "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

// For now disable migration. For now we are using local cache as storage to evaluate ideas.
// This will be turned on soon though.
func addLiveChannelMigrations(mg *migrator.Migrator) {
	//liveMessage := migrator.Table{
	//	Name: "live_message",
	//	Columns: []*migrator.Column{
	//		{Name: "id", Type: migrator.DB_BigInt, Nullable: false, IsPrimaryKey: true, IsAutoIncrement: true},
	//		{Name: "org_id", Type: migrator.DB_BigInt, Nullable: false},
	//		{Name: "channel", Type: migrator.DB_NVarchar, Length: 189, Nullable: false},
	//		{Name: "data", Type: migrator.DB_Text, Nullable: false},
	//		{Name: "published", Type: migrator.DB_DateTime, Nullable: false},
	//	},
	//	Indices: []*migrator.Index{
	//		{Cols: []string{"org_id", "channel"}, Type: migrator.UniqueIndex},
	//	},
	//}
	//
	//mg.AddMigration("create live message table", migrator.NewAddTableMigration(liveMessage))
	//mg.AddMigration("add index live_message.org_id_channel_unique", migrator.NewAddIndexMigration(liveMessage, liveMessage.Indices[0]))
}
