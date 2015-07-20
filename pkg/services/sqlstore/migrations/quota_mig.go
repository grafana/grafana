package migrations

import (
	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func addQuotaMigration(mg *Migrator) {

	var quotaV1 = Table{
		Name: "quota",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
<<<<<<< a45fe092e3c019f7fa28ff8a075cba3eccc0f82f
			{Name: "org_id", Type: DB_BigInt, Nullable: true},
			{Name: "user_id", Type: DB_BigInt, Nullable: true},
=======
			{Name: "org_id", Type: DB_BigInt, Nullable: false},
>>>>>>> inital backend suport for quotas. issue #321
			{Name: "target", Type: DB_NVarchar, Length: 255, Nullable: false},
			{Name: "limit", Type: DB_BigInt, Nullable: false},
			{Name: "created", Type: DB_DateTime, Nullable: false},
			{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
<<<<<<< a45fe092e3c019f7fa28ff8a075cba3eccc0f82f
			{Cols: []string{"org_id", "user_id", "target"}, Type: UniqueIndex},
=======
			{Cols: []string{"org_id", "target"}, Type: UniqueIndex},
>>>>>>> inital backend suport for quotas. issue #321
		},
	}
	mg.AddMigration("create quota table v1", NewAddTableMigration(quotaV1))

	//-------  indexes ------------------
	addTableIndicesMigrations(mg, "v1", quotaV1)
}
