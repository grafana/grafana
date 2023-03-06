package accesscontrol

import (
	"strings"

	"xorm.io/xorm"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func AddAdminOnlyMigration(mg *migrator.Migrator) {
	mg.AddMigration("admin only folder/dashboard permission", &adminOnlyMigrator{})
}

type adminOnlyMigrator struct {
	migrator.MigrationBase
}

func (m *adminOnlyMigrator) SQL(dialect migrator.Dialect) string {
	return CodeMigrationSQL
}

func (m *adminOnlyMigrator) Exec(sess *xorm.Session, mg *migrator.Migrator) error {
	logger := log.New("admin-permissions-only-migrator")
	type model struct {
		UID      string `xorm:"uid"`
		OrgID    int64  `xorm:"org_id"`
		IsFolder bool   `xorm:"is_folder"`
	}
	var models []model

	// Find all dashboards and folders that should have only admin permission in acl
	// When a dashboard or folder only has admin permission the acl table should be empty and the has_acl set to true
	sql := `
	SELECT res.uid, res.is_folder, res.org_id
	FROM (SELECT dashboard.id, dashboard.uid, dashboard.is_folder, dashboard.org_id, count(dashboard_acl.id) as count
		  FROM dashboard
				LEFT JOIN dashboard_acl ON dashboard.id = dashboard_acl.dashboard_id
		  WHERE dashboard.has_acl IS TRUE
		  GROUP BY dashboard.id) as res
	WHERE res.count = 0
	`

	if err := sess.SQL(sql).Find(&models); err != nil {
		return err
	}

	for _, model := range models {
		var scope string

		// set scope based on type
		if model.IsFolder {
			scope = "folders:uid:" + model.UID
		} else {
			scope = "dashboards:uid:" + model.UID
		}

		// Find all managed editor and viewer permissions with scopes to folder or dashboard
		sql = `
		SELECT r.id
		FROM role r
			LEFT JOIN permission p on r.id = p.role_id
		WHERE p.scope = ?
		AND r.org_id = ?
		AND r.name IN ('managed:builtins:editor:permissions', 'managed:builtins:viewer:permissions')
		GROUP BY r.id
		`

		var roleIDS []int64
		if err := sess.SQL(sql, scope, model.OrgID).Find(&roleIDS); err != nil {
			return err
		}

		if len(roleIDS) == 0 {
			continue
		}

		msg := "removing viewer and editor permissions on "
		if model.IsFolder {
			msg += "folder"
		} else {
			msg += "dashboard"
		}

		logger.Info(msg, "uid", model.UID)

		// Remove managed permission for editors and viewers if there was any
		removeSQL := `DELETE FROM permission WHERE scope = ? AND role_id IN(?` + strings.Repeat(", ?", len(roleIDS)-1) + `) `
		params := []interface{}{removeSQL, scope}
		for _, id := range roleIDS {
			params = append(params, id)
		}
		if _, err := sess.Exec(params...); err != nil {
			return err
		}
	}

	return nil
}
