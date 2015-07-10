package migrations

import "github.com/go-xorm/xorm"
import . "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
import "time"

func addCollectorMigration(mg *Migrator) {

	var collectorV1 = Table{
		Name: "collector",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: DB_BigInt, Nullable: false},
			{Name: "slug", Type: DB_NVarchar, Length: 255, Nullable: false},
			{Name: "name", Type: DB_NVarchar, Length: 255, Nullable: false},
			{Name: "latitude", Type: DB_Float, Nullable: true},
			{Name: "longitude", Type: DB_Float, Nullable: true},
			{Name: "public", Type: DB_Bool, Nullable: false},
			{Name: "online", Type: DB_Bool, Nullable: false},
			{Name: "enabled", Type: DB_Bool, Nullable: false},
			{Name: "created", Type: DB_DateTime, Nullable: false},
			{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"org_id", "slug"}, Type: UniqueIndex},
		},
	}
	mg.AddMigration("create collector table v1", NewAddTableMigration(collectorV1))

	//-------  indexes ------------------
	addTableIndicesMigrations(mg, "v1", collectorV1)

	// add location_tag
	var collectorTagV1 = Table{
		Name: "collector_tag",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: DB_BigInt, Nullable: false},
			{Name: "collector_id", Type: DB_BigInt, Nullable: false},
			{Name: "tag", Type: DB_NVarchar, Length: 255, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"org_id", "collector_id"}},
			{Cols: []string{"collector_id", "org_id", "tag"}, Type: UniqueIndex},
		},
	}
	mg.AddMigration("create collector_tag table v1", NewAddTableMigration(collectorTagV1))

	//-------  indexes ------------------
	addTableIndicesMigrations(mg, "v1", collectorTagV1)

	//CollectorSession
	var collectorSessionV1 = Table{
		Name: "collector_session",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: DB_BigInt, Nullable: false},
			{Name: "collector_id", Type: DB_BigInt, Nullable: false},
			{Name: "socket_id", Type: DB_NVarchar, Length: 255, Nullable: false},
			{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"org_id"}},
			{Cols: []string{"collector_id"}},
			{Cols: []string{"socket_id"}},
		},
	}
	mg.AddMigration("create collector_session table", NewAddTableMigration(collectorSessionV1))
	//-------  indexes ------------------
	instanceCol := &Column{Name: "instance_id", Type: DB_NVarchar, Length: 255, Nullable: true}
	migration := NewAddColumnMigration(collectorSessionV1, instanceCol)
	migration.OnSuccess = func(sess *xorm.Session) error {
		rawSql := "DELETE FROM collector_session"
		sess.Table("collector_session")
		_, err := sess.Exec(rawSql)
		return err
	}
	mg.AddMigration("add instance_id to collector_session table v1", migration)

	//add onlineChange, enabledChange columns
	mg.AddMigration("add online_change col to collector table v1",
		NewAddColumnMigration(collectorV1,
			&Column{Name: "online_change", Type: DB_DateTime, Nullable: true}))

	changeCol := &Column{Name: "enabled_change", Type: DB_DateTime, Nullable: true}
	addEnableChangeMig := NewAddColumnMigration(collectorV1, changeCol)
	addEnableChangeMig.OnSuccess = func(sess *xorm.Session) error {
		rawSQL := "UPDATE collector set enabled_change=?"
		sess.Table("collector")
		_, err := sess.Exec(rawSQL, time.Now())
		return err
	}
	mg.AddMigration("add enabled_change col to collector table v1", addEnableChangeMig)
}
