package store

import (
	"context"
	"database/sql"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

func (st DBstore) ListAlertInstanceData(ctx context.Context, cmd *models.ListAlertInstancesQuery) (result []*models.AlertInstanceData, err error) {
	err = st.SQLStore.WithDbSession(ctx, func(sess *db.Session) error {
		q := sess.SQL("SELECT * FROM alert_instance_data")
		if cmd.RuleOrgID > 0 {
			q = q.Where("org_id = ?", cmd.RuleOrgID)
		}
		if cmd.RuleUID != "" {
			q = q.Where("rule_uid = ?", cmd.RuleUID)
		}
		data := make([]*models.AlertInstanceData, 0)
		if err := q.Find(&data); err != nil {
			return err
		}
		result = data
		return nil
	})
	return result, err
}

func (st DBstore) SaveAlertInstanceData(ctx context.Context, alertInstances models.AlertInstanceData) error {
	return st.SQLStore.WithDbSession(ctx, func(sess *db.Session) error {
		upsertSQL := st.SQLStore.GetDialect().UpsertSQL(
			"alert_instance_data",
			[]string{"org_id", "rule_uid"},
			[]string{"org_id", "rule_uid", "data", "expires_at"})
		_, err := sess.SQL(upsertSQL, alertInstances.OrgID, alertInstances.RuleUID, alertInstances.Data, alertInstances.ExpiresAt).Query()
		if err != nil {
			return err
		}
		return nil
	})
}

func (st DBstore) DeleteAlertInstanceData(ctx context.Context, key models.AlertRuleKey) (bool, error) {
	var (
		res     sql.Result
		deleted int64
		err     error
	)
	if err = st.SQLStore.WithDbSession(ctx, func(sess *db.Session) error {
		res, err = sess.Exec("DELETE FROM alert_instance_data WHERE org_id = ? AND rule_uid = ?", key.OrgID, key.UID)
		return err
	}); err != nil {
		return false, err
	}
	deleted, err = res.RowsAffected()
	if err != nil {
		return false, err
	}
	return deleted > 0, nil
}

func (st DBstore) DeleteExpiredAlertInstanceData(ctx context.Context) (int64, error) {
	var (
		res     sql.Result
		deleted int64
		err     error
	)
	if err = st.SQLStore.WithDbSession(ctx, func(sess *db.Session) error {
		res, err = sess.Exec("DELETE FROM alert_instance_data WHERE expires_at <= ?", time.Now())
		return err
	}); err != nil {
		return -1, err
	}
	deleted, err = res.RowsAffected()
	return deleted, err
}
