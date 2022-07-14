package store

import (
	"context"
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type InstanceStore interface {
	GetAlertInstance(ctx context.Context, cmd *models.GetAlertInstanceQuery) error
	ListAlertInstances(ctx context.Context, cmd *models.ListAlertInstancesQuery) error
	SaveAlertInstances(ctx context.Context, cmd *models.SaveAlertInstancesCommand) error
	FetchOrgIds(ctx context.Context) ([]int64, error)
	DeleteAlertInstances(ctx context.Context, keys ...InstanceKey) error
}

type InstanceKey struct {
	OrgID      int64
	RuleUID    string
	LabelsHash string
}

// GetAlertInstance is a handler for retrieving an alert instance based on OrgId, AlertDefintionID, and
// the hash of the labels.
func (st DBstore) GetAlertInstance(ctx context.Context, cmd *models.GetAlertInstanceQuery) error {
	return st.SQLStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		instance := models.AlertInstance{}
		s := strings.Builder{}
		s.WriteString(`SELECT * FROM alert_instance
			WHERE
				rule_org_id=? AND
				rule_uid=? AND
				labels_hash=?
		`)

		_, hash, err := cmd.Labels.StringAndHash()
		if err != nil {
			return err
		}

		params := append(make([]interface{}, 0), cmd.RuleOrgID, cmd.RuleUID, hash)

		has, err := sess.SQL(s.String(), params...).Get(&instance)
		if !has {
			return fmt.Errorf("instance not found for labels %v (hash: %v), alert rule %v (org %v)", cmd.Labels, hash, cmd.RuleUID, cmd.RuleOrgID)
		}
		if err != nil {
			return err
		}

		cmd.Result = &instance
		return nil
	})
}

// ListAlertInstances is a handler for retrieving alert instances within specific organisation
// based on various filters.
func (st DBstore) ListAlertInstances(ctx context.Context, cmd *models.ListAlertInstancesQuery) error {
	return st.SQLStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		alertInstances := make([]*models.AlertInstance, 0)

		s := strings.Builder{}
		params := make([]interface{}, 0)

		addToQuery := func(stmt string, p ...interface{}) {
			s.WriteString(stmt)
			params = append(params, p...)
		}

		addToQuery("SELECT alert_instance.*, alert_rule.title AS rule_title FROM alert_instance LEFT JOIN alert_rule ON alert_instance.rule_org_id = alert_rule.org_id AND alert_instance.rule_uid = alert_rule.uid WHERE rule_org_id = ?", cmd.RuleOrgID)

		if cmd.RuleUID != "" {
			addToQuery(` AND rule_uid = ?`, cmd.RuleUID)
		}

		if cmd.State != "" {
			addToQuery(` AND current_state = ?`, cmd.State)
		}

		if cmd.StateReason != "" {
			addToQuery(` AND current_reason = ?`, cmd.StateReason)
		}

		if err := sess.SQL(s.String(), params...).Find(&alertInstances); err != nil {
			return err
		}

		cmd.Result = alertInstances
		return nil
	})
}

// SaveAlertInstances saves all the provided alert instances in a single write transaction.
func (st DBstore) SaveAlertInstances(ctx context.Context, cmd *models.SaveAlertInstancesCommand) error {
	rowLimit := 400
	for i := 0; i < len(cmd.Instances); i += rowLimit {
		err := st.SQLStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
			values := make([]interface{}, 0)
			limit := i + rowLimit
			if len(cmd.Instances) < limit {
				limit = len(cmd.Instances)
			}

			for _, fields := range cmd.Instances[i:limit] {
				labelTupleJSON, labelsHash, err := fields.Labels.StringAndHash()
				if err != nil {
					return err
				}

				alertInstance := &models.AlertInstance{
					RuleOrgID:         fields.RuleOrgID,
					RuleUID:           fields.RuleUID,
					Labels:            fields.Labels,
					LabelsHash:        labelsHash,
					CurrentState:      fields.State,
					CurrentReason:     fields.StateReason,
					CurrentStateSince: fields.CurrentStateSince,
					CurrentStateEnd:   fields.CurrentStateEnd,
					LastEvalTime:      fields.LastEvalTime,
				}

				if err := models.ValidateAlertInstance(alertInstance); err != nil {
					return err
				}

				values = append(values, alertInstance.RuleOrgID, alertInstance.RuleUID, labelTupleJSON, alertInstance.LabelsHash,
					alertInstance.CurrentState, alertInstance.CurrentReason, alertInstance.CurrentStateSince.Unix(),
					alertInstance.CurrentStateEnd.Unix(), alertInstance.LastEvalTime.Unix())
			}

			upsertSQL, err := st.SQLStore.Dialect.UpsertMultipleSQL(
				"alert_instance",
				[]string{"rule_org_id", "rule_uid", "labels_hash"},
				[]string{"rule_org_id", "rule_uid", "labels", "labels_hash", "current_state", "current_reason", "current_state_since", "current_state_end", "last_eval_time"},
				len(cmd.Instances))
			if err != nil {
				return err
			}

			_, err = sess.SQL(upsertSQL, values...).Query()
			if err != nil {
				return err
			}

			return nil
		})
		if err != nil {
			return err
		}
	}
	return nil
}

func (st DBstore) FetchOrgIds(ctx context.Context) ([]int64, error) {
	orgIds := []int64{}

	err := st.SQLStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		s := strings.Builder{}
		params := make([]interface{}, 0)

		addToQuery := func(stmt string, p ...interface{}) {
			s.WriteString(stmt)
			params = append(params, p...)
		}

		addToQuery("SELECT DISTINCT rule_org_id FROM alert_instance")

		if err := sess.SQL(s.String(), params...).Find(&orgIds); err != nil {
			return err
		}
		return nil
	})

	return orgIds, err
}

func (st DBstore) DeleteAlertInstances(ctx context.Context, keys ...InstanceKey) error {
	if len(keys) == 0 {
		return nil
	}

	return st.SQLStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		for _, k := range keys {
			_, err := sess.Exec("DELETE FROM alert_instance WHERE rule_org_id = ? AND rule_uid = ? AND labels_hash = ?",
				k.OrgID, k.RuleUID, k.LabelsHash)
			if err != nil {
				return err
			}
		}
		return nil
	})
}
