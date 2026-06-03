package migrations

import . "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addDashboardCommentsMigrations(mg *Migrator) {
	threadV1 := Table{
		Name: "dashboard_comment_thread",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: DB_BigInt, Nullable: false},
			{Name: "dashboard_uid", Type: DB_NVarchar, Length: 40, Nullable: false},
			{Name: "anchor_panel_key", Type: DB_NVarchar, Length: 64, Nullable: false},
			{Name: "anchor_x_norm", Type: DB_Double, Nullable: false, Default: "0"},
			{Name: "anchor_y_norm", Type: DB_Double, Nullable: false, Default: "0"},
			{Name: "context_panel_title", Type: DB_NVarchar, Length: 255, Nullable: true},
			{Name: "context_time_from", Type: DB_NVarchar, Length: 64, Nullable: true},
			{Name: "context_time_to", Type: DB_NVarchar, Length: 64, Nullable: true},
			{Name: "resolved", Type: DB_Bool, Nullable: false, Default: "0"},
			{Name: "resolved_by_user_id", Type: DB_BigInt, Nullable: false, Default: "0"},
			{Name: "resolved_at", Type: DB_DateTime, Nullable: true},
			{Name: "created_by_user_id", Type: DB_BigInt, Nullable: false},
			{Name: "created_at", Type: DB_DateTime, Nullable: false},
			{Name: "updated_at", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"org_id", "dashboard_uid"}, Type: IndexType},
			{Cols: []string{"org_id", "created_by_user_id"}, Type: IndexType},
		},
	}

	messageV1 := Table{
		Name: "dashboard_comment_message",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "thread_id", Type: DB_BigInt, Nullable: false},
			{Name: "author_user_id", Type: DB_BigInt, Nullable: false},
			{Name: "body", Type: DB_Text, Nullable: false},
			{Name: "created_at", Type: DB_DateTime, Nullable: false},
			{Name: "updated_at", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"thread_id", "created_at"}, Type: IndexType},
		},
	}

	mg.AddMigration("create dashboard_comment_thread table", NewAddTableMigration(threadV1))
	for _, idx := range threadV1.Indices {
		mg.AddMigration("add index dashboard_comment_thread "+idx.XName(threadV1.Name), NewAddIndexMigration(threadV1, idx))
	}

	mg.AddMigration("create dashboard_comment_message table", NewAddTableMigration(messageV1))
	for _, idx := range messageV1.Indices {
		mg.AddMigration("add index dashboard_comment_message "+idx.XName(messageV1.Name), NewAddIndexMigration(messageV1, idx))
	}

	mg.AddMigration("add author_type to dashboard_comment_message", NewAddColumnMigration(messageV1, &Column{
		Name: "author_type", Type: DB_NVarchar, Length: 16, Nullable: false, Default: "'user'",
	}))
}
