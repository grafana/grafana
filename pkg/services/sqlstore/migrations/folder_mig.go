package migrations

import (
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"xorm.io/xorm"
)

func addFolderMigrations(mg *migrator.Migrator) {
	mg.AddMigration("create folder table", migrator.NewAddTableMigration(folderv1()))

	mg.AddMigration("Add index for parent_uid", migrator.NewAddIndexMigration(folderv1(), &migrator.Index{
		Cols: []string{"parent_uid", "org_id"},
	}))

	mg.AddMigration("Add unique index for folder.uid and folder.org_id", migrator.NewAddIndexMigration(folderv1(), &migrator.Index{
		Type: migrator.UniqueIndex,
		Cols: []string{"uid", "org_id"},
	}))

	mg.AddMigration("Update folder title length", migrator.NewTableCharsetMigration("folder", []*migrator.Column{
		// it should be lower than 191 (the maximum length of indexable VARCHAR fields in MySQL 5.6 <= with utf8mb4 encoding)
		// but the title column length of the dashboard table whose values are copied into this column is 189
		{Name: "title", Type: migrator.DB_NVarchar, Length: 189, Nullable: false},
	}))

	mg.AddMigration("Add unique index for folder.title and folder.parent_uid", migrator.NewAddIndexMigration(folderv1(), &migrator.Index{
		Type: migrator.UniqueIndex,
		Cols: []string{"title", "parent_uid"},
	}))
	mg.AddMigration("Remove unique index for folder.title and folder.parent_uid", migrator.NewDropIndexMigration(folderv1(), &migrator.Index{
		Type: migrator.UniqueIndex,
		Cols: []string{"title", "parent_uid"},
	}))

	mg.AddMigration("Add unique index for title, parent_uid, and org_id", migrator.NewAddIndexMigration(folderv1(), &migrator.Index{
		Type: migrator.UniqueIndex,
		Cols: []string{"title", "parent_uid", "org_id"},
	}))

	mg.AddMigration("Sync dashboard and folder table", migrator.NewRawSQLMigration("").
		Mysql(`
			INSERT INTO folder (uid, org_id, title, created, updated)
			SELECT * FROM (SELECT uid, org_id, title, created, updated FROM dashboard WHERE is_folder = 1) AS derived
			ON DUPLICATE KEY UPDATE title=derived.title, updated=derived.updated
		`).Postgres(`
			INSERT INTO folder (uid, org_id, title, created, updated)
			SELECT uid, org_id, title, created, updated FROM dashboard WHERE is_folder = true
			ON CONFLICT(uid, org_id) DO UPDATE SET title=excluded.title, updated=excluded.updated
		`).SQLite(`
			INSERT INTO folder (uid, org_id, title, created, updated)
			SELECT uid, org_id, title, created, updated FROM dashboard WHERE is_folder = 1
			ON CONFLICT DO UPDATE SET title=excluded.title, updated=excluded.updated
		`))

	mg.AddMigration("Remove ghost folders from the folder table", migrator.NewRawSQLMigration(`
			DELETE FROM folder WHERE NOT EXISTS
				(SELECT 1 FROM dashboard WHERE dashboard.uid = folder.uid AND dashboard.org_id = folder.org_id AND dashboard.is_folder = true)
	`))

	mg.AddMigration("Remove unique index UQE_folder_uid_org_id", migrator.NewDropIndexMigration(folderv1(), &migrator.Index{
		Type: migrator.UniqueIndex,
		Cols: []string{"uid", "org_id"},
	}))

	mg.AddMigration("Add unique index UQE_folder_org_id_uid", migrator.NewAddIndexMigration(folderv1(), &migrator.Index{
		Type: migrator.UniqueIndex,
		Cols: []string{"org_id", "uid"},
	}))

	mg.AddMigration("Remove unique index UQE_folder_title_parent_uid_org_id", migrator.NewDropIndexMigration(folderv1(), &migrator.Index{
		Type: migrator.UniqueIndex,
		Cols: []string{"title", "parent_uid", "org_id"},
	}))

	mg.AddMigration("Add unique index UQE_folder_org_id_parent_uid_title", migrator.NewAddIndexMigration(folderv1(), &migrator.Index{
		Type: migrator.UniqueIndex,
		Cols: []string{"org_id", "parent_uid", "title"},
	}))

	// No need to introduce IDX_folder_org_id_parent_uid because is covered by UQE_folder_org_id_parent_uid_title
	mg.AddMigration("Remove index IDX_folder_parent_uid_org_id", migrator.NewDropIndexMigration(folderv1(), &migrator.Index{
		Cols: []string{"parent_uid", "org_id"},
	}))

	// Remove the unique name constraint
	mg.AddMigration("Remove unique index UQE_folder_org_id_parent_uid_title", migrator.NewDropIndexMigration(folderv1(), &migrator.Index{
		Type: migrator.UniqueIndex,
		Cols: []string{"org_id", "parent_uid", "title"},
	}))

	// BMC Change: Start
	// Delete emtpy OOTB folders created by 25.3
	mg.AddMigration("Delete empty folders matching predefined OOTB folders", &EmptyFolderCleanupMigration{})
	// BMC Change: End
}

// BMC Code: Start

type EmptyFolderCleanupMigration struct {
	migrator.MigrationBase
}

func (m *EmptyFolderCleanupMigration) SQL(dialect migrator.Dialect) string {
	return "code migration"
}

func (m *EmptyFolderCleanupMigration) Exec(sess *xorm.Session, mg *migrator.Migrator) error {
	mg.Logger.Info("Starting empty folder cleanup migration")

	folderTitles := []string{
		"Operations Management", "Helix Business Workflows", "Dynamic Service Modeling", "Helix Dashboards Administrator",
		"Helix OpenTelemetry Dashboards", "Helix Continuous Optimization", "License Usage", "Service Dashboards",
		"Helix Chatbot", "Intelligent Automation", "Helix ITSM", "Automation", "Helix Digital Workplace",
		"Configuration Management", "Helix Common Services", "Log Analytics", "Helix AI Service Management", "Helix Live Chat",
	}

	type Folder struct {
		Id    int64
		UID   string `xorm:"uid"`
		Title string
	}

	var folders []Folder

	// Prepare IN clause for SQL query
	inQuery := "'" + strings.Join(folderTitles, "', '") + "'"

	query := fmt.Sprintf(`
		SELECT f.id, f.uid, f.title
        FROM dashboard f
        LEFT JOIN dashboard d ON d.folder_id = f.id AND d.is_folder = false
        WHERE f.is_folder = true AND f.title IN (%s)
        AND f.uid IS NOT NULL AND f.uid != ''
        GROUP BY f.id, f.uid, f.title
		HAVING COUNT(d.id) = 0`, inQuery)

	mg.Logger.Debug("Executing query to find empty folders", "query", query)

	err := sess.SQL(query).Find(&folders)
	if err != nil {
		mg.Logger.Error("Failed to fetch folders", "error", err)
		return err
	}

	if len(folders) == 0 {
		mg.Logger.Debug("No empty folders found for deletion")
		return nil
	}

	mg.Logger.Debug("Found folders to delete", "count", len(folders))

	// Process in batches
	const batchSize = 100
	for i := 0; i < len(folders); i += batchSize {
		end := i + batchSize
		if end > len(folders) {
			end = len(folders)
		}
		batch := folders[i:end]

		// Extract UIDs
		var uids []string

		for _, folder := range batch {
			if folder.UID == "" {
				mg.Logger.Warn("Skipping folder with empty UID", "title", folder.Title, "id", folder.Id)
				continue
			}
			mg.Logger.Debug("Folder candidate", "uid", folder.UID, "title", folder.Title, "id", folder.Id)
			uids = append(uids, folder.UID)
		}
		mg.Logger.Debug("Deleting folder batch", "start", i+1, "end", end, "batch_size", len(uids))

		if err := deleteFolders(sess, uids, mg.Logger); err != nil {
			mg.Logger.Error("Failed to delete batch", "start", i+1, "end", end, "error", err)
			return err
		}

		mg.Logger.Debug("Successfully deleted folder batch", "start", i+1, "end", end)
	}

	mg.Logger.Info("Completed empty folder cleanup migration")
	return nil
}

func deleteFolders(sess *xorm.Session, uids []string, logger log.Logger) error {

	// Prepare UID IN clause
	uidClause := "'" + strings.Join(uids, "', '") + "'"

	// Prepare scope clause
	var scopes []string
	for _, uid := range uids {
		scopes = append(scopes, "folders:uid:"+uid)
	}
	scopeClause := "'" + strings.Join(scopes, "', '") + "'"

	logger.Debug("Deleting related data for UIDs", "uids", uids)

	// 1. Delete from folder table
	logger.Debug("Deleting from folder table", "uid_count", len(uids))
	logger.Debug(fmt.Sprintf(`DELETE FROM folder WHERE uid IN (%s)`, uidClause))
	if _, err := sess.Exec(fmt.Sprintf(`DELETE FROM folder WHERE uid IN (%s)`, uidClause)); err != nil {
		logger.Error("Folder delete failed", "error", err)
		return fmt.Errorf("folder delete failed: %w", err)
	}
	// 2. Delete from permission
	logger.Debug("Deleting from permission", "scope_count", len(scopes))
	logger.Debug(fmt.Sprintf(`DELETE FROM permission WHERE scope IN (%s)`, scopeClause))
	if _, err := sess.Exec(fmt.Sprintf(`DELETE FROM permission WHERE scope IN (%s)`, scopeClause)); err != nil {
		logger.Error("Permission delete failed", "error", err)
		return fmt.Errorf("permission delete failed: %w", err)
	}

	// 3. Delete from dashboard where folder entry exists
	logger.Debug("Deleting from dashboard (folder entries only)", "uid_count", len(uids))
	logger.Debug(fmt.Sprintf(`DELETE FROM dashboard WHERE uid IN (%s) AND is_folder = '1'`, uidClause))
	if _, err := sess.Exec(fmt.Sprintf(`DELETE FROM dashboard WHERE uid IN (%s) AND is_folder = '1'`, uidClause)); err != nil {
		logger.Error("Dashboard delete failed", "error", err)
		return fmt.Errorf("dashboard delete failed: %w", err)
	}

	logger.Debug("Successfully deleted folder and related records", "uid_count", len(uids))
	return nil
}

//BMC Code:End

func folderv1() migrator.Table {
	// Do not make any changes to this schema; introduce new migrations for further changes
	return migrator.Table{
		Name: "folder",
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "uid", Type: migrator.DB_NVarchar, Length: 40},
			{Name: "org_id", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "title", Type: migrator.DB_NVarchar, Length: 255, Nullable: false},
			{Name: "description", Type: migrator.DB_NVarchar, Length: 255, Nullable: true},
			{Name: "parent_uid", Type: migrator.DB_NVarchar, Length: 40, Nullable: true},
			{Name: "created", Type: migrator.DB_DateTime, Nullable: false},
			{Name: "updated", Type: migrator.DB_DateTime, Nullable: false},
		},
	}
}
