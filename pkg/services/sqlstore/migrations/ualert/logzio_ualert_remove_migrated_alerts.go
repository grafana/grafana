package ualert

import (
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"os"
	"xorm.io/xorm"
)

// LOGZ.IO GRAFANA CHANGE :: DEV-30705 - Add endpoint to migrate alerts of organization

// RmOrgAlertMigration removes Grafana 8 alert data. Based on ualert.rmMigration code
type RmOrgAlertMigration struct {
	migrator.MigrationBase
	OrgId int64
}

func (m *RmOrgAlertMigration) SQL(dialect migrator.Dialect) string {
	return "code migration"
}

func (m *RmOrgAlertMigration) Exec(sess *xorm.Session, mg *migrator.Migrator) error {
	_, err := sess.Exec("delete from alert_rule where org_id = ?", m.OrgId)
	if err != nil {
		return err
	}

	_, err = sess.Exec("delete from alert_rule_version where rule_org_id = ?", m.OrgId)
	if err != nil {
		return err
	}

	_, err = sess.Exec("delete from dashboard_acl where dashboard_id IN (select id from dashboard where created_by = ?) and org_id = ?", FOLDER_CREATED_BY, m.OrgId)
	if err != nil {
		return err
	}

	_, err = sess.Exec("delete from dashboard where created_by = ? and org_id = ?", FOLDER_CREATED_BY, m.OrgId)
	if err != nil {
		return err
	}

	_, err = sess.Exec("delete from alert_configuration where org_id = ?", m.OrgId)
	if err != nil {
		return err
	}

	_, err = sess.Exec("delete from ngalert_configuration where org_id = ?", m.OrgId)
	if err != nil {
		return err
	}

	_, err = sess.Exec("delete from alert_instance where rule_org_id = ?", m.OrgId)
	if err != nil {
		return err
	}

	exists, err := sess.IsTableExist("kv_store")
	if err != nil {
		return err
	}

	if exists {
		_, err = sess.Exec("delete from kv_store where namespace = ? and org_id = ?", KV_NAMESPACE, m.OrgId)
		if err != nil {
			return err
		}
	}

	files, err := getSilenceFileNamesForAllOrgs(mg)
	if err != nil {
		return err
	}
	for _, f := range files {
		if err := os.Remove(f); err != nil {
			mg.Logger.Error("alert migration error: failed to remove silence file", "file", f, "err", err)
		}
	}

	return nil
}

// LOGZ.IO GRAFANA CHANGE :: end
