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
func (ng *AlertNG) getAlertInstance(cmd *getAlertInstanceQuery) error {
	return ng.SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		instance := AlertInstance{}
		s := strings.Builder{}
		s.WriteString(`SELECT * FROM alert_instance
			WHERE
				def_org_id=? AND
				def_uid=? AND
				labels_hash=?
		`)

		_, hash, err := cmd.Labels.StringAndHash()
		if err != nil {
			return err
		}

		params := append(make([]interface{}, 0), cmd.DefinitionOrgID, cmd.DefinitionUID, hash)

		has, err := sess.SQL(s.String(), params...).Get(&instance)
		if !has {
			return fmt.Errorf("instance not found for labels %v (hash: %v), alert definition %v (org %v)", cmd.Labels, hash, cmd.DefinitionUID, cmd.DefinitionOrgID)
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
func (ng *AlertNG) listAlertInstances(cmd *listAlertInstancesQuery) error {
	return ng.SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		alertInstances := make([]*listAlertInstancesQueryResult, 0)

		s := strings.Builder{}
		params := make([]interface{}, 0)

		addToQuery := func(stmt string, p ...interface{}) {
			s.WriteString(stmt)
			params = append(params, p...)
		}

		addToQuery("SELECT alert_instance.*, alert_definition.title AS def_title FROM alert_instance LEFT JOIN alert_definition ON alert_instance.def_org_id = alert_definition.org_id AND alert_instance.def_uid = alert_definition.uid WHERE def_org_id = ?", cmd.DefinitionOrgID)

		if cmd.DefinitionUID != "" {
			addToQuery(` AND def_uid = ?`, cmd.DefinitionUID)
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
			DefinitionOrgID:   cmd.DefinitionOrgID,
			DefinitionUID:     cmd.DefinitionUID,
			Labels:            cmd.Labels,
			LabelsHash:        labelsHash,
			CurrentState:      cmd.State,
			CurrentStateSince: time.Now(),
			LastEvalTime:      cmd.LastEvalTime,
		}

		if err := validateAlertInstance(alertInstance); err != nil {
			return err
		}

		params := append(make([]interface{}, 0), alertInstance.DefinitionOrgID, alertInstance.DefinitionUID, labelTupleJSON, alertInstance.LabelsHash, alertInstance.CurrentState, alertInstance.CurrentStateSince.Unix(), alertInstance.LastEvalTime.Unix())

		upsertSQL := ng.SQLStore.Dialect.UpsertSQL(
			"alert_instance",
			[]string{"def_org_id", "def_uid", "labels_hash"},
			[]string{"def_org_id", "def_uid", "labels", "labels_hash", "current_state", "current_state_since", "last_eval_time"})
		_, err = sess.SQL(upsertSQL, params...).Query()
		if err != nil {
			return err
		}

		return nil
	})
}
