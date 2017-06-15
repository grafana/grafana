package migrations

import . "github.com/wangy1931/grafana/pkg/services/sqlstore/migrator"

func addSystemMigrations(mg *Migrator) {
  systemsV1 := Table{
    Name: "systems",
    Columns: []*Column{
      {Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
      {Name: "systems_name", Type: DB_NVarchar, Length: 255, Nullable: false},
      {Name: "slug", Type: DB_NVarchar, Length: 255, Nullable: false},
      {Name: "org_id", Type: DB_BigInt, Length: 255, Nullable: false},
    },
  }

  // add systems table
  mg.AddMigration("create systems table ", NewAddTableMigration(systemsV1))

  system_dash := Table{
    Name: "system_dash",
    Columns: []*Column{
      {Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
      {Name: "system_id", Type: DB_BigInt, Nullable: false},
      {Name: "dashboard_id", Type: DB_BigInt, Nullable: false},
    },
  }
  mg.AddMigration("create system_dash table ", NewAddTableMigration(system_dash))

  system_user := Table{
    Name: "system_user",
    Columns: []*Column{
      {Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
      {Name: "system_id", Type: DB_BigInt, Nullable: false},
      {Name: "user_id", Type: DB_NVarchar, Length: 255, Nullable: false},
    },
  }
  mg.AddMigration("create system_user table ", NewAddTableMigration(system_user))

  system_pick := Table{
    Name: "system_pick",
    Columns: []*Column{
      {Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
      {Name: "user_id", Type: DB_NVarchar, Length: 255, Nullable: false},
      {Name: "system_id", Type: DB_BigInt, Nullable: false},
    },
  }
  mg.AddMigration("create system_pick table ", NewAddTableMigration(system_pick))
}
