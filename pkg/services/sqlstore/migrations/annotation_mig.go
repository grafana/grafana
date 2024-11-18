package migrations

import (
	"xorm.io/xorm"

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

	//
	// Annotation tag
	//
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

	// drop dashboard indexes
	addDropAllIndicesMigrations(mg, "v2", annotationTagTable)
	// rename table
	addTableRenameMigration(mg, "annotation_tag", "annotation_tag_v2", "v2")

	// annotation_tag v3
	annotationTagTableV3 := Table{
		Name: "annotation_tag",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "annotation_id", Type: DB_BigInt, Nullable: false},
			{Name: "tag_id", Type: DB_BigInt, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"annotation_id", "tag_id"}, Type: UniqueIndex},
		},
	}

	// recreate table
	mg.AddMigration("Create annotation_tag table v3", NewAddTableMigration(annotationTagTableV3))
	// recreate indices
	addTableIndicesMigrations(mg, "Add unique index annotation_tag.annotation_id_tag_id V3", annotationTagTableV3)
	// copy data
	mg.AddMigration("copy annotation_tag v2 to v3", NewCopyTableDataMigration("annotation_tag", "annotation_tag_v2", map[string]string{
		"annotation_id": "annotation_id",
		"tag_id":        "tag_id",
	}))

	mg.AddMigration("drop table annotation_tag_v2", NewDropTableMigration("annotation_tag_v2"))

	//
	// clear alert text
	//
	updateTextFieldSQL := "UPDATE annotation SET TEXT = '' WHERE alert_id > 0"
	mg.AddMigration("Update alert annotations and set TEXT to empty", NewRawSQLMigration(updateTextFieldSQL))

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
	// Convert epoch saved as seconds to milliseconds
	//
	updateEpochSQL := "UPDATE annotation SET epoch = (epoch*1000) where epoch < 9999999999"
	mg.AddMigration("Convert existing annotations from seconds to milliseconds", NewRawSQLMigration(updateEpochSQL))

	//
	// 6.4: Make Regions a single annotation row
	//
	mg.AddMigration("Add epoch_end column", NewAddColumnMigration(table, &Column{
		Name: "epoch_end", Type: DB_BigInt, Nullable: false, Default: "0",
	}))
	mg.AddMigration("Add index for epoch_end", NewAddIndexMigration(table, &Index{
		Cols: []string{"org_id", "epoch", "epoch_end"}, Type: IndexType,
	}))
	mg.AddMigration("Make epoch_end the same as epoch", NewRawSQLMigration("UPDATE annotation SET epoch_end = epoch"))
	mg.AddMigration("Move region to single row", &AddMakeRegionSingleRowMigration{})

	//
	// 6.6.1: Optimize annotation queries
	//
	mg.AddMigration("Remove index org_id_epoch from annotation table", NewDropIndexMigration(table, &Index{
		Cols: []string{"org_id", "epoch"}, Type: IndexType,
	}))

	mg.AddMigration("Remove index org_id_dashboard_id_panel_id_epoch from annotation table", NewDropIndexMigration(table, &Index{
		Cols: []string{"org_id", "dashboard_id", "panel_id", "epoch"}, Type: IndexType,
	}))

	mg.AddMigration("Add index for org_id_dashboard_id_epoch_end_epoch on annotation table", NewAddIndexMigration(table, &Index{
		Cols: []string{"org_id", "dashboard_id", "epoch_end", "epoch"}, Type: IndexType,
	}))

	mg.AddMigration("Add index for org_id_epoch_end_epoch on annotation table", NewAddIndexMigration(table, &Index{
		Cols: []string{"org_id", "epoch_end", "epoch"}, Type: IndexType,
	}))

	mg.AddMigration("Remove index org_id_epoch_epoch_end from annotation table", NewDropIndexMigration(table, &Index{
		Cols: []string{"org_id", "epoch", "epoch_end"}, Type: IndexType,
	}))

	mg.AddMigration("Add index for alert_id on annotation table", NewAddIndexMigration(table, &Index{
		Cols: []string{"alert_id"}, Type: IndexType,
	}))

	mg.AddMigration("Increase tags column to length 4096", NewRawSQLMigration("").
		Postgres("ALTER TABLE annotation ALTER COLUMN tags TYPE VARCHAR(4096);").
		Mysql("ALTER TABLE annotation MODIFY tags VARCHAR(4096);"))

	mg.AddMigration("Increase prev_state column to length 40 not null", NewRawSQLMigration("").
		Postgres("ALTER TABLE annotation ALTER COLUMN prev_state TYPE VARCHAR(40);"). // Does not modify nullability.
		Mysql("ALTER TABLE annotation MODIFY prev_state VARCHAR(40) NOT NULL;"))

	mg.AddMigration("Increase new_state column to length 40 not null", NewRawSQLMigration("").
		Postgres("ALTER TABLE annotation ALTER COLUMN new_state TYPE VARCHAR(40);"). // Does not modify nullability.
		Mysql("ALTER TABLE annotation MODIFY new_state VARCHAR(40) NOT NULL;"))
}

type AddMakeRegionSingleRowMigration struct {
	MigrationBase
}

func (m *AddMakeRegionSingleRowMigration) SQL(dialect Dialect) string {
	return "code migration"
}

type TempRegionInfoDTO struct {
	RegionId int64
	Epoch    int64
}

func (m *AddMakeRegionSingleRowMigration) Exec(sess *xorm.Session, mg *Migrator) error {
	regions := make([]*TempRegionInfoDTO, 0)

	err := sess.SQL("SELECT region_id, epoch FROM annotation WHERE region_id>0 AND region_id <> id").Find(&regions)

	if err != nil {
		return err
	}

	for _, region := range regions {
		_, err := sess.Exec("UPDATE annotation SET epoch_end = ? WHERE id = ?", region.Epoch, region.RegionId)
		if err != nil {
			return err
		}
	}

	_, err = sess.Exec("DELETE FROM annotation WHERE region_id > 0 AND id <> region_id")
	return err
}
