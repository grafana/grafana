package legacyannotations

import (
	"fmt"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

// AddMigrations registers the columns this package needs on table, so a legacy table
// adopts annotations in one line:
//
//	legacyannotations.AddMigrations(mg, table)
//
// The IDs are qualified by table name because a migration ID is global and frozen once
// shipped: a second table adopting this would otherwise collide with the first.
func AddMigrations(mg *migrator.Migrator, table migrator.Table) {
	// MEDIUMTEXT, not TEXT, because a client can put an arbitrary amount in an
	// annotation and MySQL's TEXT stops at 64KB. The keys that can hold the most --
	// a kubectl manifest, with secrets in it -- are dropped by Policy before they
	// reach the row, but nothing bounds the rest.
	mg.AddMigration(fmt.Sprintf("add %s.%s column", table.Name, annotationColumn),
		migrator.NewAddColumnMigration(table, &migrator.Column{
			Name: annotationColumn, Type: migrator.DB_MediumText, Nullable: true,
		}))

	// The manager gets columns rather than living in the blob so it stays queryable.
	// Width matches the identical column in provenance_type.
	mg.AddMigration(fmt.Sprintf("add %s.%s column", table.Name, managerKindColumn),
		migrator.NewAddColumnMigration(table, &migrator.Column{
			Name: managerKindColumn, Type: migrator.DB_NVarchar, Length: 40, Nullable: true,
		}))

	mg.AddMigration(fmt.Sprintf("add %s.%s column", table.Name, managerIdentityColumn),
		migrator.NewAddColumnMigration(table, &migrator.Column{
			Name: managerIdentityColumn, Type: migrator.DB_NVarchar, Length: 190, Nullable: true,
		}))
}
