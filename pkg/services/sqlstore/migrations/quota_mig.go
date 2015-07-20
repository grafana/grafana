package migrations

import (
<<<<<<< dd59006883d8094231b294b25a1a91366264034d
	. "github.com/Cepave/grafana/pkg/services/sqlstore/migrator"
=======
	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
>>>>>>> inital backend suport for quotas. issue #321
)

func addQuotaMigration(mg *Migrator) {

	var quotaV1 = Table{
		Name: "quota",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
<<<<<<< dd59006883d8094231b294b25a1a91366264034d
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
<<<<<<< dd59006883d8094231b294b25a1a91366264034d
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
