package ngalert

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/services/sqlstore"
)

// getAlertInstance is a handler for retrieving an alert instance based on OrgId, AlertDefintionID, and
// the hash of the labels.
// nolint:unused
func (ng *AlertNG) getAlertInstance(cmd *getAlertInstanceCommand) error {
	return ng.SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		instance := AlertInstance{}
		s := strings.Builder{}
		s.WriteString(`SELECT * FROM alert_instance
			WHERE
				org_id=? AND
				alert_definition_uid=? AND
				labels_hash=?
		`)

		_, hash, err := cmd.Labels.StringAndHash()
		if err != nil {
			return err
		}

		params := append(make([]interface{}, 0), cmd.AlertDefinitionOrgID, cmd.AlertDefinitionUID, hash)

		has, err := sess.SQL(s.String(), params...).Get(&instance)
		if !has {
			return fmt.Errorf("instance not found for labels %v (hash: %v), alert definition %v (org %v)", cmd.Labels, hash, cmd.AlertDefinitionUID, cmd.AlertDefinitionOrgID)
		}
		if err != nil {
			return err
		}

		cmd.Result = &instance
		return nil
	})
}

// listAlertInstances is a handler for retrieving alert instances within specific organisation
// based on various filters.
func (ng *AlertNG) listAlertInstances(cmd *listAlertInstancesCommand) error {
	return ng.SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		alertInstances := make([]*AlertInstance, 0)

		s := strings.Builder{}
		params := make([]interface{}, 0)

		addToQuery := func(stmt string, p ...interface{}) {
			s.WriteString(stmt)
			params = append(params, p...)
		}

		addToQuery("SELECT * FROM alert_instance WHERE org_id = ?", cmd.AlertDefinitionOrgID)

		if cmd.AlertDefinitionUID != "" {
			addToQuery(` AND alert_definition_uid = ?`, cmd.AlertDefinitionUID)
		}

		if cmd.State != "" {
			addToQuery(` AND current_state = ?`, cmd.State)
		}

		if err := sess.SQL(s.String(), params...).Find(&alertInstances); err != nil {
			return err
		}

		cmd.Result = alertInstances
		return nil
	})
}

// saveAlertDefinition is a handler for saving a new alert definition.
// nolint:unused
func (ng *AlertNG) saveAlertInstance(cmd *saveAlertInstanceCommand) error {
	return ng.SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		labelTupleJSON, labelsHash, err := cmd.Labels.StringAndHash()
		if err != nil {
			return err
		}

		alertInstance := &AlertInstance{
			AlertDefinitionOrgID: cmd.AlertDefinitionOrgID,
			AlertDefinitionUID:   cmd.AlertDefinitionUID,
			Labels:               cmd.Labels,
			LabelsHash:           labelsHash,
			CurrentState:         cmd.State,
			CurrentStateSince:    time.Now(),
			LastEvalTime:         cmd.LastEvalTime,
		}

		if err := validateAlertInstance(alertInstance); err != nil {
			return err
		}

		params := append(make([]interface{}, 0), alertInstance.AlertDefinitionOrgID, alertInstance.AlertDefinitionUID, labelTupleJSON, alertInstance.LabelsHash, alertInstance.CurrentState, alertInstance.CurrentStateSince.Unix(), alertInstance.LastEvalTime.Unix())

		upsertSQL := ng.SQLStore.Dialect.UpsertSQL(
			"alert_instance",
			[]string{"org_id", "alert_definition_uid", "labels_hash"},
			[]string{"org_id", "alert_definition_uid", "labels", "labels_hash", "current_state", "current_state_since", "last_eval_time"})
		_, err = sess.SQL(upsertSQL, params...).Query()
		if err != nil {
			return err
		}

		return nil
	})
}
