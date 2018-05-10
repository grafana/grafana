package migrations

import (
	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func addAnnotationMig(mg *Migrator) {

	table := Table{
		Name: "annotation",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: DB_BigInt, Nullable: false},
			{Name: "alert_id", Type: DB_BigInt, Nullable: true},
			{Name: "user_id", Type: DB_BigInt, Nullable: true},
			{Name: "dashboard_id", Type: DB_BigInt, Nullable: true},
			{Name: "panel_id", Type: DB_BigInt, Nullable: true},
			{Name: "category_id", Type: DB_BigInt, Nullable: true},
			{Name: "type", Type: DB_NVarchar, Length: 25, Nullable: false},
			{Name: "title", Type: DB_Text, Nullable: false},
			{Name: "text", Type: DB_Text, Nullable: false},
			{Name: "metric", Type: DB_NVarchar, Length: 255, Nullable: true},
			{Name: "prev_state", Type: DB_NVarchar, Length: 25, Nullable: false},
			{Name: "new_state", Type: DB_NVarchar, Length: 25, Nullable: false},
			{Name: "data", Type: DB_Text, Nullable: false},
			{Name: "epoch", Type: DB_BigInt, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"org_id", "alert_id"}, Type: IndexType},
			{Cols: []string{"org_id", "type"}, Type: IndexType},
			{Cols: []string{"org_id", "category_id"}, Type: IndexType},
			{Cols: []string{"org_id", "dashboard_id", "panel_id", "epoch"}, Type: IndexType},
			{Cols: []string{"org_id", "epoch"}, Type: IndexType},
		},
	}

	mg.AddMigration("Drop old annotation table v4", NewDropTableMigration("annotation"))
	mg.AddMigration("create annotation table v5", NewAddTableMigration(table))

	// create indices
	mg.AddMigration("add index annotation 0 v3", NewAddIndexMigration(table, table.Indices[0]))
	mg.AddMigration("add index annotation 1 v3", NewAddIndexMigration(table, table.Indices[1]))
	mg.AddMigration("add index annotation 2 v3", NewAddIndexMigration(table, table.Indices[2]))
	mg.AddMigration("add index annotation 3 v3", NewAddIndexMigration(table, table.Indices[3]))
	mg.AddMigration("add index annotation 4 v3", NewAddIndexMigration(table, table.Indices[4]))

	mg.AddMigration("Update annotation table charset", NewTableCharsetMigration("annotation", []*Column{
		{Name: "type", Type: DB_NVarchar, Length: 25, Nullable: false},
		{Name: "title", Type: DB_Text, Nullable: false},
		{Name: "text", Type: DB_Text, Nullable: false},
		{Name: "metric", Type: DB_NVarchar, Length: 255, Nullable: true},
		{Name: "prev_state", Type: DB_NVarchar, Length: 25, Nullable: false},
		{Name: "new_state", Type: DB_NVarchar, Length: 25, Nullable: false},
		{Name: "data", Type: DB_Text, Nullable: false},
	}))

	mg.AddMigration("Add column region_id to annotation table", NewAddColumnMigration(table, &Column{
		Name: "region_id", Type: DB_BigInt, Nullable: true, Default: "0",
	}))

	categoryIdIndex := &Index{Cols: []string{"org_id", "category_id"}, Type: IndexType}
	mg.AddMigration("Drop category_id index", NewDropIndexMigration(table, categoryIdIndex))

	mg.AddMigration("Add column tags to annotation table", NewAddColumnMigration(table, &Column{
		Name: "tags", Type: DB_NVarchar, Nullable: true, Length: 500,
	}))

	///
	/// Annotation tag
	///
	annotationTagTable := Table{
		Name: "annotation_tag",
		Columns: []*Column{
			{Name: "annotation_id", Type: DB_BigInt, Nullable: false},
			{Name: "tag_id", Type: DB_BigInt, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"annotation_id", "tag_id"}, Type: UniqueIndex},
		},
	}

	mg.AddMigration("Create annotation_tag table v2", NewAddTableMigration(annotationTagTable))
	mg.AddMigration("Add unique index annotation_tag.annotation_id_tag_id", NewAddIndexMigration(annotationTagTable, annotationTagTable.Indices[0]))

	//
	// clear alert text
	//
	updateTextFieldSql := "UPDATE annotation SET TEXT = '' WHERE alert_id > 0"
	mg.AddMigration("Update alert annotations and set TEXT to empty", NewRawSqlMigration(updateTextFieldSql))

	//
	// Add a 'created' & 'updated' column
	//
	mg.AddMigration("Add created time to annotation table", NewAddColumnMigration(table, &Column{
		Name: "created", Type: DB_BigInt, Nullable: true, Default: "0",
	}))
	mg.AddMigration("Add updated time to annotation table", NewAddColumnMigration(table, &Column{
		Name: "updated", Type: DB_BigInt, Nullable: true, Default: "0",
	}))
	mg.AddMigration("Add index for created in annotation table", NewAddIndexMigration(table, &Index{
		Cols: []string{"org_id", "created"}, Type: IndexType,
	}))
	mg.AddMigration("Add index for updated in annotation table", NewAddIndexMigration(table, &Index{
		Cols: []string{"org_id", "updated"}, Type: IndexType,
	}))

	//
	// Convert epoch saved as seconds to miliseconds
	//
	updateEpochSql := "UPDATE annotation SET epoch = (epoch*1000) where epoch < 9999999999"
	mg.AddMigration("Convert existing annotations from seconds to milliseconds", NewRawSqlMigration(updateEpochSql))
}
