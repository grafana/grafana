package migrations

import (
	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func addAnnotationCategoryMig(mg *Migrator) {
	category := Table{
		Name: "annotation_category",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: DB_BigInt, Nullable: false},
			{Name: "user_id", Type: DB_BigInt, Nullable: true},
			{Name: "name", Type: DB_Text, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"org_id", "name"}, Type: IndexType},
		},
	}

	// create table
	mg.AddMigration("create annotation_category table", NewAddTableMigration(category))

	// create indices
	mg.AddMigration("add index org_id & name", NewAddIndexMigration(category, category.Indices[0]))
}
