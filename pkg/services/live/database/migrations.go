package database

import "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

// For now disable migration. For now we are using local cache as storage to evaluate ideas.
// This will be turned on soon though.
func AddLiveMessageMigrations(_ *migrator.Migrator) {
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

func AddLiveChannelRuleMigrations(mg *migrator.Migrator) {
	liveChannelRule := migrator.Table{
		Name: "live_channel_rule",
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_BigInt, Nullable: false, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "version", Type: migrator.DB_Int, Nullable: false},
			{Name: "org_id", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "pattern", Type: migrator.DB_NVarchar, Length: 189, Nullable: false},
			{Name: "config", Type: migrator.DB_Text, Nullable: false},
			{Name: "secure", Type: migrator.DB_Text, Nullable: false},
			{Name: "created", Type: migrator.DB_DateTime, Nullable: false},
			{Name: "updated", Type: migrator.DB_DateTime, Nullable: false},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"org_id", "pattern"}, Type: migrator.UniqueIndex},
		},
	}
	mg.AddMigration("create live channel rule table", migrator.NewAddTableMigration(liveChannelRule))
	mg.AddMigration("add index live_channel_rule.org_id_channel_unique", migrator.NewAddIndexMigration(liveChannelRule, liveChannelRule.Indices[0]))
}
