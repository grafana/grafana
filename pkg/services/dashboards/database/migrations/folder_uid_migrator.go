package migrations

import (
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"xorm.io/xorm"
)

// FolderUIDMigration is a code migration that populates folder_uid column
type FolderUIDMigration struct {
	migrator.MigrationBase
}

func (m *FolderUIDMigration) SQL(dialect migrator.Dialect) string {
	return "code migration"
}

func (m *FolderUIDMigration) Exec(sess *xorm.Session, migrator *migrator.Migrator) error {
	// for dashboards the source of truth is the dashboard table
	q := `UPDATE dashboard SET folder_uid = (SELECT derived.uid FROM (SELECT d.uid FROM dashboard AS d WHERE d.id = dashboard.folder_id) AS derived) WHERE is_folder = ?`
	r, err := sess.Exec(q, migrator.Dialect.BooleanStr(false))
	if err != nil {
		migrator.Logger.Error("Failed to migrate dashboard folder_uid for dashboards", "error", err)
		return err
	}
	dashboardRowsAffected, dashboardRowsAffectedErr := r.RowsAffected()
	if dashboardRowsAffectedErr != nil {
		migrator.Logger.Error("Failed to get dashboard rows affected", "error", dashboardRowsAffectedErr)
	}

	// for folders the source of truth is the folder table
	q = `UPDATE dashboard SET folder_uid = (SELECT f.parent_uid FROM folder f WHERE f.org_id = dashboard.org_id AND f.uid = dashboard.uid) WHERE is_folder = ?`
	r, err = sess.Exec(q, migrator.Dialect.BooleanStr(true))
	if err != nil {
		migrator.Logger.Error("Failed to migrate dashboard folder_uid for folders", "error", err)
		return err
	}

	folderRowsAffected, folderRowsAffectedErr := r.RowsAffected()
	if folderRowsAffectedErr != nil {
		migrator.Logger.Error("Failed to get folder rows affected", "error", folderRowsAffectedErr)
	}

	migrator.Logger.Debug("Migrating dashboard data", "dashboards rows", dashboardRowsAffected, "folder rows", folderRowsAffected)
	return nil
}

func AddDashboardFolderMigrations(mg *migrator.Migrator) {
	mg.AddMigration("Add folder_uid for dashboard", migrator.NewAddColumnMigration(migrator.Table{Name: "dashboard"}, &migrator.Column{
		Name: "folder_uid", Type: migrator.DB_NVarchar, Length: 40, Nullable: true,
	}))

	mg.AddMigration("Populate dashboard folder_uid column", &FolderUIDMigration{})

	mg.AddMigration("Add unique index for dashboard_org_id_folder_uid_title", migrator.NewAddIndexMigration(migrator.Table{Name: "dashboard"}, &migrator.Index{
		Cols: []string{"org_id", "folder_uid", "title"}, Type: migrator.UniqueIndex,
	}))
}
