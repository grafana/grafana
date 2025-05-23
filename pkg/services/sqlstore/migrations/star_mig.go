package migrations

import (
	"fmt"

	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/util/xorm"
)

// does not rely on dashboard table existing, can be run before dashboard migrations
func addStarMigrations(mg *Migrator) {
	starV1 := Table{
		Name: "star",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "user_id", Type: DB_BigInt, Nullable: false},
			{Name: "dashboard_id", Type: DB_BigInt, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"user_id", "dashboard_id"}, Type: UniqueIndex},
		},
	}

	mg.AddMigration("create star table", NewAddTableMigration(starV1))
	mg.AddMigration("add unique index star.user_id_dashboard_id", NewAddIndexMigration(starV1, starV1.Indices[0]))
	mg.AddMigration("Add column dashboard_uid in star", NewAddColumnMigration(starV1, &Column{
		Name: "dashboard_uid", Type: DB_NVarchar, Length: 40, Nullable: true,
	}))
	mg.AddMigration("Add column org_id in star", NewAddColumnMigration(starV1, &Column{
		Name: "org_id", Type: DB_BigInt, Nullable: true, Default: "1",
	}))
	mg.AddMigration("Add column updated in star", NewAddColumnMigration(starV1, &Column{
		Name: "updated", Type: DB_DateTime, Nullable: true,
	}))
	mg.AddMigration("add index in star table on dashboard_uid, org_id and user_id columns",
		NewAddIndexMigration(starV1, &Index{
			Cols: []string{"user_id", "dashboard_uid", "org_id"},
			Type: UniqueIndex,
		}))
}

// relies on the dashboard table existing & must be run after the dashboard migrations are run
func addDashboardUIDStarMigrations(mg *Migrator) {
	mg.AddMigration("Add missing dashboard_uid and org_id to star", &FillDashbordUIDMigration{})
}

type FillDashbordUIDMigration struct {
	MigrationBase
}

func (m *FillDashbordUIDMigration) SQL(dialect Dialect) string {
	return "code migration"
}

func (m *FillDashbordUIDMigration) Exec(sess *xorm.Session, mg *Migrator) error {
	return RunStarMigrations(sess, mg.Dialect.DriverName())
}

func RunStarMigrations(sess *xorm.Session, driverName string) error {
	// sqlite
	sql := `UPDATE star
	SET
    	dashboard_uid = (SELECT uid FROM dashboard WHERE dashboard.id = star.dashboard_id),
    	org_id = (SELECT org_id FROM dashboard WHERE dashboard.id = star.dashboard_id),
    	updated = DATETIME('now')
	WHERE
    	(dashboard_uid IS NULL OR org_id IS NULL)
    	AND EXISTS (SELECT 1 FROM dashboard WHERE dashboard.id = star.dashboard_id);`
	switch driverName {
	case Postgres:
		sql = `UPDATE star
		SET dashboard_uid = dashboard.uid,
			org_id = dashboard.org_id,
			updated = NOW()
		FROM dashboard
		WHERE star.dashboard_id = dashboard.id
			AND (star.dashboard_uid IS NULL OR star.org_id IS NULL);`
	case MySQL:
		sql = `UPDATE star
		LEFT JOIN dashboard ON star.dashboard_id = dashboard.id
		SET star.dashboard_uid = dashboard.uid,
			star.org_id = dashboard.org_id,
			star.updated = NOW()
		WHERE star.dashboard_uid IS NULL OR star.org_id IS NULL;`
	}

	if _, err := sess.Exec(sql); err != nil {
		return fmt.Errorf("failed to set dashboard_uid, org_id, and updated for star: %w", err)
	}

	return nil
}
