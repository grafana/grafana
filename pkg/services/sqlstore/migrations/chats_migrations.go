package migrations

import (
	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func addChatMigrations(mg *Migrator) {
	chatTable := Table{
		Name: "chat",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, Nullable: false, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: DB_BigInt, Nullable: false},
			{Name: "content_type_id", Type: DB_SmallInt, Nullable: false},
			{Name: "object_id", Type: DB_NVarchar, Length: 128, Nullable: false},
			{Name: "settings", Type: DB_MediumText, Nullable: false},
			{Name: "created", Type: DB_Int, Nullable: false},
			{Name: "updated", Type: DB_Int, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"org_id", "content_type_id", "object_id"}, Type: UniqueIndex},
		},
	}
	mg.AddMigration("create chat table", NewAddTableMigration(chatTable))
	mg.AddMigration("add index chat.org_id_content_type_id_object_id", NewAddIndexMigration(chatTable, chatTable.Indices[0]))
}

func addChatMessageMigrations(mg *Migrator) {
	messageTable := Table{
		Name: "chat_message",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, Nullable: false, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "chat_id", Type: DB_BigInt, Nullable: false},
			{Name: "user_id", Type: DB_BigInt, Nullable: true},
			{Name: "content", Type: DB_MediumText, Nullable: false},
			{Name: "created", Type: DB_Int, Nullable: false},
			{Name: "updated", Type: DB_Int, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"chat_id"}, Type: IndexType},
			{Cols: []string{"created"}, Type: IndexType},
		},
	}
	mg.AddMigration("create chat message table", NewAddTableMigration(messageTable))
	mg.AddMigration("add index chat_message.chat_id", NewAddIndexMigration(messageTable, messageTable.Indices[0]))
	mg.AddMigration("add index chat_message.created", NewAddIndexMigration(messageTable, messageTable.Indices[1]))
}
