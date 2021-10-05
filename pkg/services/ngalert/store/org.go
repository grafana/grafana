package store

import (
	"context"

	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type OrgStore interface {
	GetOrgs(ctx context.Context) ([]int64, error)
	DeleteOrgEntries(ctx context.Context, orgID int64) error
}

func (st DBstore) GetOrgs(ctx context.Context) ([]int64, error) {
	orgs := make([]int64, 0)
	err := st.SQLStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		q := "SELECT id FROM org"
		if err := sess.SQL(q).Find(&orgs); err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return orgs, nil
}

// DeleteOrgEntries deletes all database records coresponding to this org
// that are part ngAlert.
func (st DBstore) DeleteOrgEntries(ctx context.Context, orgID int64) error {
	queries := []string{
		"DELETE FROM ngalert_configuration WHERE org_id = ?",
		"DELETE FROM alert_configuration WHERE org_id = ?",
		"DELETE FROM alert_instance WHERE rule_org_id = ?",
		"DELETE FROM alert_notification WHERE org_id = ?",
		"DELETE FROM alert_notification_state WHERE org_id = ?",
		"DELETE FROM alert_rule WHERE org_id = ?",
		"DELETE FROM alert_rule_tag WHERE EXISTS (SELECT 1 FROM alert WHERE alert.org_id = ? AND alert.id = alert_rule_tag.alert_id)",
		"DELETE FROM alert_rule_version WHERE rule_org_id = ?",
	}
	return st.SQLStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		for _, query := range queries {
			_, err := sess.Exec(query, orgID)
			if err != nil {
				return err
			}
		}
		return nil
	})
}
