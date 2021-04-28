package store

import (
	"context"
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

// GetAlertInstance is a handler for retrieving an alert instance based on OrgId, AlertDefintionID, and
// the hash of the labels.
// nolint:unused
func (st DBstore) GetAlertInstance(cmd *models.GetAlertInstanceQuery) error {
	return st.SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		instance := models.AlertInstance{}
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

// ListAlertInstances is a handler for retrieving alert instances within specific organisation
// based on various filters.
func (st DBstore) ListAlertInstances(cmd *models.ListAlertInstancesQuery) error {
	return st.SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		alertInstances := make([]*models.ListAlertInstancesQueryResult, 0)

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

// SaveAlertInstance is a handler for saving a new alert instance.
// nolint:unused
func (st DBstore) SaveAlertInstance(cmd *models.SaveAlertInstanceCommand) error {
	return st.SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		labelTupleJSON, labelsHash, err := cmd.Labels.StringAndHash()
		if err != nil {
			return err
		}

		alertInstance := &models.AlertInstance{
			DefinitionOrgID:   cmd.DefinitionOrgID,
			DefinitionUID:     cmd.DefinitionUID,
			Labels:            cmd.Labels,
			LabelsHash:        labelsHash,
			CurrentState:      cmd.State,
			CurrentStateSince: cmd.CurrentStateSince,
			CurrentStateEnd:   cmd.CurrentStateEnd,
			LastEvalTime:      cmd.LastEvalTime,
		}

		if err := models.ValidateAlertInstance(alertInstance); err != nil {
			return err
		}

		params := append(make([]interface{}, 0), alertInstance.DefinitionOrgID, alertInstance.DefinitionUID, labelTupleJSON, alertInstance.LabelsHash, alertInstance.CurrentState, alertInstance.CurrentStateSince.Unix(), alertInstance.CurrentStateEnd.Unix(), alertInstance.LastEvalTime.Unix())

		upsertSQL := st.SQLStore.Dialect.UpsertSQL(
			"alert_instance",
			[]string{"def_org_id", "def_uid", "labels_hash"},
			[]string{"def_org_id", "def_uid", "labels", "labels_hash", "current_state", "current_state_since", "current_state_end", "last_eval_time"})
		_, err = sess.SQL(upsertSQL, params...).Query()
		if err != nil {
			return err
		}

		return nil
	})
}

func (st DBstore) FetchOrgIds(cmd *models.FetchUniqueOrgIdsQuery) error {
	return st.SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		orgIds := make([]*models.FetchUniqueOrgIdsQueryResult, 0)

		s := strings.Builder{}
		params := make([]interface{}, 0)

		addToQuery := func(stmt string, p ...interface{}) {
			s.WriteString(stmt)
			params = append(params, p...)
		}

		addToQuery("SELECT DISTINCT def_org_id FROM alert_instance")

		if err := sess.SQL(s.String(), params...).Find(&orgIds); err != nil {
			return err
		}

		cmd.Result = orgIds
		return nil
	})
}
