package migrations

import . "github.com/wangy1931/grafana/pkg/services/sqlstore/migrator"

func addServiceMigrations(mg *Migrator) {
  servicesV1 := Table{
    Name: "services",
    Columns: []*Column{
      {Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
      {Name: "service_name", Type: DB_NVarchar, Length: 255, Nullable: false},
      {Name: "description", Type: DB_NVarchar, Length: 255, Nullable: false},
      {Name: "org_id", Type: DB_BigInt, Length: 255, Nullable: false},
    },
  }

  // add services table
  mg.AddMigration("create services table ", NewAddTableMigration(servicesV1))

}
