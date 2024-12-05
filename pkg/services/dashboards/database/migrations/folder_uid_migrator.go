package migrations

import (
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"xorm.io/xorm"
)

type DummyMigration struct {
	migrator.MigrationBase
}

func (m *DummyMigration) SQL(dialect migrator.Dialect) string {
	return "code migration"
}

func (m *DummyMigration) Exec(sess *xorm.Session, mgrtr *migrator.Migrator) error {
	return nil
}

// FolderUIDMigration is a code migration that populates folder_uid column
type FolderUIDMigration struct {
	migrator.MigrationBase
}

func (m *FolderUIDMigration) SQL(dialect migrator.Dialect) string {
	return "code migration"
}

func (m *FolderUIDMigration) Exec(sess *xorm.Session, mgrtr *migrator.Migrator) error {
	// for dashboards the source of truth is the  dashboard table
	q := `UPDATE dashboard
	SET folder_uid = folder.uid
	FROM dashboard folder
	WHERE dashboard.folder_id = folder.id
	  AND dashboard.is_folder = ?`
	if mgrtr.Dialect.DriverName() == migrator.MySQL {
		q = `UPDATE dashboard AS d
		LEFT JOIN dashboard AS folder ON d.folder_id = folder.id
		SET d.folder_uid = folder.uid
		WHERE d.is_folder = ?`
	}

	r, err := sess.Exec(q, mgrtr.Dialect.BooleanStr(false))
	if err != nil {
		mgrtr.Logger.Error("Failed to migrate dashboard folder_uid for dashboards", "error", err)
		return err
	}
	dashboardRowsAffected, dashboardRowsAffectedErr := r.RowsAffected()
	if dashboardRowsAffectedErr != nil {
		mgrtr.Logger.Error("Failed to get dashboard rows affected", "error", dashboardRowsAffectedErr)
	}

	// for folders the source of truth is the folder table
	// covered by UQE_folder_org_id_uid
	q = `UPDATE dashboard
	SET folder_uid = folder.parent_uid
	FROM folder
	WHERE dashboard.uid = folder.uid AND dashboard.org_id = folder.org_id
	AND dashboard.is_folder = ?`

	// covered by UQE_folder_org_id_uid
	if mgrtr.Dialect.DriverName() == migrator.MySQL {
		q = `UPDATE dashboard
		SET folder_uid = (
		    SELECT folder.parent_uid
		    FROM folder
		    WHERE dashboard.uid = folder.uid AND dashboard.org_id = folder.org_id
		)
		WHERE is_folder = ?`
	}
	r, err = sess.Exec(q, mgrtr.Dialect.BooleanStr(true))
	if err != nil {
		mgrtr.Logger.Error("Failed to migrate dashboard folder_uid for folders", "error", err)
		return err
	}

	folderRowsAffected, folderRowsAffectedErr := r.RowsAffected()
	if folderRowsAffectedErr != nil {
		mgrtr.Logger.Error("Failed to get folder rows affected", "error", folderRowsAffectedErr)
	}

	mgrtr.Logger.Debug("Migrating dashboard data", "dashboards rows", dashboardRowsAffected, "folder rows", folderRowsAffected)
	return nil
}

func AddDashboardFolderMigrations(mg *migrator.Migrator) {
	mg.AddMigration("Add folder_uid for dashboard", migrator.NewAddColumnMigration(migrator.Table{Name: "dashboard"}, &migrator.Column{
		Name: "folder_uid", Type: migrator.DB_NVarchar, Length: 40, Nullable: true,
	}))

	mg.AddMigration("Populate dashboard folder_uid column", &FolderUIDMigration{})

	mg.AddMigration("Add unique index for dashboard_org_id_folder_uid_title", &DummyMigration{})

	mg.AddMigration("Delete unique index for dashboard_org_id_folder_id_title", migrator.NewDropIndexMigration(migrator.Table{Name: "dashboard"}, &migrator.Index{
		Cols: []string{"org_id", "folder_id", "title"}, Type: migrator.UniqueIndex,
	}))

	mg.AddMigration("Delete unique index for dashboard_org_id_folder_uid_title", &DummyMigration{})

	// Removed a few lines below
	mg.AddMigration("Add unique index for dashboard_org_id_folder_uid_title_is_folder", migrator.NewAddIndexMigration(migrator.Table{Name: "dashboard"}, &migrator.Index{
		Cols: []string{"org_id", "folder_uid", "title", "is_folder"}, Type: migrator.UniqueIndex,
	}))

	// Temporary index until decommisioning of folder_id in query
	mg.AddMigration("Restore index for dashboard_org_id_folder_id_title", migrator.NewAddIndexMigration(migrator.Table{Name: "dashboard"}, &migrator.Index{
		Cols: []string{"org_id", "folder_id", "title"},
	}))

	mg.AddMigration("Remove unique index for dashboard_org_id_folder_uid_title_is_folder", migrator.NewDropIndexMigration(migrator.Table{Name: "dashboard"}, &migrator.Index{
		Cols: []string{"org_id", "folder_uid", "title", "is_folder"}, Type: migrator.UniqueIndex,
	}))
}
