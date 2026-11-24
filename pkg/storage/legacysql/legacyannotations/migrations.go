package legacyannotations

import (
	"fmt"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

// AddMigrations registers the columns this package needs on table, so a legacy table
// adopts annotations in one line:
//
//	legacyannotations.AddMigrations(mg, tableV2, "org_id")
//
// scopeCols are the columns a manager query is scoped by -- the tenant, usually -- and
// they lead the index so that "everything this manager owns in this org" is one range
// scan. Pass none for a table with no such scope.
//
// The IDs are qualified by table name because a migration ID is global and frozen once
// shipped: a second table adopting this would otherwise collide with the first.
func AddMigrations(mg *migrator.Migrator, table migrator.Table, scopeCols ...string) {
	// MEDIUMTEXT, not TEXT, because a client can put an arbitrary amount in an
	// annotation and MySQL's TEXT stops at 64KB. The keys that can hold the most --
	// a kubectl manifest, with secrets in it -- are dropped by Policy before they
	// reach the row, but nothing bounds the rest.
	mg.AddMigration(fmt.Sprintf("add %s.%s column", table.Name, annotationColumn),
		migrator.NewAddColumnMigration(table, &migrator.Column{
			Name: annotationColumn, Type: migrator.DB_MediumText, Nullable: true,
		}))

	// The manager is the one part of the metadata worth querying by, so it gets
	// columns rather than living in the blob. Width matches the identical column in
	// provenance_type and is the MySQL utf8mb4 index-prefix limit.
	mg.AddMigration(fmt.Sprintf("add %s.%s column", table.Name, managerKindColumn),
		migrator.NewAddColumnMigration(table, &migrator.Column{
			Name: managerKindColumn, Type: migrator.DB_NVarchar, Length: 40, Nullable: true,
		}))

	mg.AddMigration(fmt.Sprintf("add %s.%s column", table.Name, managerIdentityColumn),
		migrator.NewAddColumnMigration(table, &migrator.Column{
			Name: managerIdentityColumn, Type: migrator.DB_NVarchar, Length: 190, Nullable: true,
		}))

	cols := make([]string, 0, len(scopeCols)+2)
	cols = append(cols, scopeCols...)
	cols = append(cols, managerKindColumn, managerIdentityColumn)
	mg.AddMigration(fmt.Sprintf("add index %s.manager", table.Name),
		migrator.NewAddIndexMigration(table, &migrator.Index{Cols: cols}))
}
