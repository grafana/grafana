package migrations

import . "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addOrgMigrations(mg *Migrator) {
	orgV1 := Table{
		Name: "org",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "version", Type: DB_Int, Nullable: false},
			{Name: "name", Type: DB_NVarchar, Length: 190, Nullable: false},
			{Name: "address1", Type: DB_NVarchar, Length: 255, Nullable: true},
			{Name: "address2", Type: DB_NVarchar, Length: 255, Nullable: true},
			{Name: "city", Type: DB_NVarchar, Length: 255, Nullable: true},
			{Name: "state", Type: DB_NVarchar, Length: 255, Nullable: true},
			{Name: "zip_code", Type: DB_NVarchar, Length: 50, Nullable: true},
			{Name: "country", Type: DB_NVarchar, Length: 255, Nullable: true},
			{Name: "billing_email", Type: DB_NVarchar, Length: 255, Nullable: true},
			{Name: "created", Type: DB_DateTime, Nullable: false},
			{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
		// BMC code
		// Start kavraham, remove unique index to allow different tenant (org) with the same name (https://jira.bmc.com/browse/DRJ71-730)
		//   Indices: []*Index{
		// 	   {Cols: []string{"name"}, Type: UniqueIndex},
		//     },
		// End
	}

	// add org v1
	mg.AddMigration("create org table v1", NewAddTableMigration(orgV1))
	// BMC code
	// addTableIndicesMigrations(mg, "v1", orgV1)
	// Abhishek, 07122020, alter id column to bigint
	mg.AddMigration("alter org.id to bigint", NewRawSQLMigration("").
		Postgres("ALTER TABLE public.org ALTER COLUMN id TYPE int8;"))
	// kavraham, remove unique index from `name` coloumn in `org` table.
	mg.AddMigration("drop 'UQE_org_name' index ", NewDropIndexMigration(orgV1, &Index{Cols: []string{"name"}, Type: UniqueIndex}))
	// End

	orgUserV1 := Table{
		Name: "org_user",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: DB_BigInt},
			{Name: "user_id", Type: DB_BigInt},
			{Name: "role", Type: DB_NVarchar, Length: 20},
			{Name: "created", Type: DB_DateTime},
			{Name: "updated", Type: DB_DateTime},
		},
		Indices: []*Index{
			{Cols: []string{"org_id"}},
			{Cols: []string{"org_id", "user_id"}, Type: UniqueIndex},
			{Cols: []string{"user_id"}},
		},
	}

	//-------  org_user table -------------------
	mg.AddMigration("create org_user table v1", NewAddTableMigration(orgUserV1))
	addTableIndicesMigrations(mg, "v1", orgUserV1)

	mg.AddMigration("Update org table charset", NewTableCharsetMigration("org", []*Column{
		{Name: "name", Type: DB_NVarchar, Length: 190, Nullable: false},
		{Name: "address1", Type: DB_NVarchar, Length: 255, Nullable: true},
		{Name: "address2", Type: DB_NVarchar, Length: 255, Nullable: true},
		{Name: "city", Type: DB_NVarchar, Length: 255, Nullable: true},
		{Name: "state", Type: DB_NVarchar, Length: 255, Nullable: true},
		{Name: "zip_code", Type: DB_NVarchar, Length: 50, Nullable: true},
		{Name: "country", Type: DB_NVarchar, Length: 255, Nullable: true},
		{Name: "billing_email", Type: DB_NVarchar, Length: 255, Nullable: true},
	}))

	mg.AddMigration("Update org_user table charset", NewTableCharsetMigration("org_user", []*Column{
		{Name: "role", Type: DB_NVarchar, Length: 20},
	}))

	const migrateReadOnlyViewersToViewers = `UPDATE org_user SET role = 'Viewer' WHERE role = 'Read Only Editor'`
	mg.AddMigration("Migrate all Read Only Viewers to Viewers", NewRawSQLMigration(migrateReadOnlyViewersToViewers))
}
