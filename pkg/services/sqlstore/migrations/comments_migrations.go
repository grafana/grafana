package migrations

import (
	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func addCommentGroupMigrations(mg *Migrator) {
	commentGroupTable := Table{
		Name: "comment_group",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, Nullable: false, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: DB_BigInt, Nullable: false},
			{Name: "object_type", Type: DB_NVarchar, Length: 10, Nullable: false},
			{Name: "object_id", Type: DB_NVarchar, Length: 128, Nullable: false},
			{Name: "settings", Type: DB_MediumText, Nullable: false},
			{Name: "created", Type: DB_Int, Nullable: false},
			{Name: "updated", Type: DB_Int, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"org_id", "object_type", "object_id"}, Type: UniqueIndex},
		},
	}
	mg.AddMigration("create comment group table", NewAddTableMigration(commentGroupTable))
	mg.AddMigration("add index comment_group.org_id_object_type_object_id", NewAddIndexMigration(commentGroupTable, commentGroupTable.Indices[0]))
}

func addCommentMigrations(mg *Migrator) {
	commentTable := Table{
		Name: "comment",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, Nullable: false, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "group_id", Type: DB_BigInt, Nullable: false},
			{Name: "user_id", Type: DB_BigInt, Nullable: false},
			{Name: "content", Type: DB_MediumText, Nullable: false},
			{Name: "created", Type: DB_Int, Nullable: false},
			{Name: "updated", Type: DB_Int, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"group_id"}, Type: IndexType},
			{Cols: []string{"created"}, Type: IndexType},
		},
	}
	mg.AddMigration("create comment table", NewAddTableMigration(commentTable))
	mg.AddMigration("add index comment.group_id", NewAddIndexMigration(commentTable, commentTable.Indices[0]))
	mg.AddMigration("add index comment.created", NewAddIndexMigration(commentTable, commentTable.Indices[1]))
}
