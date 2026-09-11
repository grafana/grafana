package store

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/db"
)

// SaveAlertRuleStatus persists the serialized app-platform status subresource for a
// single rule into the alert_rule.k8s_status column.
//
// It updates only that column via raw SQL rather than the xorm alertRule bean: the
// bean's version tag would trigger optimistic-lock version bumping, and status writes
// must never bump the rule's version/updated so that spec change-detection (git sync,
// provisioning) stays blind to status churn.
func (st DBstore) SaveAlertRuleStatus(ctx context.Context, orgID int64, ruleUID string, data []byte) error {
	return st.SQLStore.WithDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.Exec("UPDATE alert_rule SET k8s_status = ? WHERE org_id = ? AND uid = ?", data, orgID, ruleUID)
		return err
	})
}
