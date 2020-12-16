package ngalert

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/util"
)

func getAlertDefinitionByID(alertDefinitionID int64, sess *sqlstore.DBSession) (*AlertDefinition, error) {
	alertDefinition := AlertDefinition{}
	has, err := sess.ID(alertDefinitionID).Get(&alertDefinition)
	if !has {
		return nil, errAlertDefinitionNotFound
	}
	if err != nil {
		return nil, err
	}
	return &alertDefinition, nil
}

// deleteAlertDefinitionByID is a handler for deleting an alert definition.
// It returns models.ErrAlertDefinitionNotFound if no alert definition is found for the provided ID.
func (ng *AlertNG) deleteAlertDefinitionByID(cmd *deleteAlertDefinitionByIDCommand) error {
	return ng.SQLStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		res, err := sess.Exec("DELETE FROM alert_definition WHERE id = ?", cmd.ID)
		if err != nil {
			return err
		}

		rowsAffected, err := res.RowsAffected()
		if err != nil {
			return err
		}
		cmd.RowsAffected = rowsAffected

		_, err = sess.Exec("DELETE FROM alert_definition_version WHERE alert_definition_id = ?", cmd.ID)
		if err != nil {
			return err
		}

		return nil
	})
}

// getAlertDefinitionByID is a handler for retrieving an alert definition from that database by its ID.
// It returns models.ErrAlertDefinitionNotFound if no alert definition is found for the provided ID.
func (ng *AlertNG) getAlertDefinitionByID(query *getAlertDefinitionByIDQuery) error {
	return ng.SQLStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		alertDefinition, err := getAlertDefinitionByID(query.ID, sess)
		if err != nil {
			return err
		}
		query.Result = alertDefinition
		return nil
	})
}

// saveAlertDefinition is a handler for saving a new alert definition.
func (ng *AlertNG) saveAlertDefinition(cmd *saveAlertDefinitionCommand) error {
	return ng.SQLStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		intervalSeconds := defaultIntervalSeconds
		if cmd.IntervalSeconds != nil {
			intervalSeconds = *cmd.IntervalSeconds
		}

		var initialVersion int64 = 1

		uid, err := generateNewAlertDefinitionUID(sess, cmd.OrgID)
		if err != nil {
			return fmt.Errorf("failed to generate UID for alert definition %q: %w", cmd.Title, err)
		}

		alertDefinition := &AlertDefinition{
			OrgID:           cmd.OrgID,
			Title:           cmd.Title,
			Condition:       cmd.Condition.RefID,
			Data:            cmd.Condition.QueriesAndExpressions,
			IntervalSeconds: intervalSeconds,
			Version:         initialVersion,
			UID:             uid,
		}

		if err := ng.validateAlertDefinition(alertDefinition, false); err != nil {
			return err
		}

		if err := alertDefinition.preSave(); err != nil {
			return err
		}

		if _, err := sess.Insert(alertDefinition); err != nil {
			return err
		}

		alertDefVersion := AlertDefinitionVersion{
			AlertDefinitionID:  alertDefinition.ID,
			AlertDefinitionUID: alertDefinition.UID,
			Version:            alertDefinition.Version,
			Created:            alertDefinition.Updated,
			Condition:          alertDefinition.Condition,
			Title:              alertDefinition.Title,
			Data:               alertDefinition.Data,
			IntervalSeconds:    alertDefinition.IntervalSeconds,
		}
		if _, err := sess.Insert(alertDefVersion); err != nil {
			return err
		}

		cmd.Result = alertDefinition
		return nil
	})
}

// updateAlertDefinition is a handler for updating an existing alert definition.
// It returns models.ErrAlertDefinitionNotFound if no alert definition is found for the provided ID.
func (ng *AlertNG) updateAlertDefinition(cmd *updateAlertDefinitionCommand) error {
	return ng.SQLStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		alertDefinition := &AlertDefinition{
			ID:        cmd.ID,
			Title:     cmd.Title,
			Condition: cmd.Condition.RefID,
			Data:      cmd.Condition.QueriesAndExpressions,
			OrgID:     cmd.OrgID,
		}
		if cmd.IntervalSeconds != nil {
			alertDefinition.IntervalSeconds = *cmd.IntervalSeconds
		}

		if err := ng.validateAlertDefinition(alertDefinition, true); err != nil {
			return err
		}

		if err := alertDefinition.preSave(); err != nil {
			return err
		}

		existingAlertDefinition, err := getAlertDefinitionByID(alertDefinition.ID, sess)
		if err != nil {
			if errors.Is(err, errAlertDefinitionNotFound) {
				cmd.Result = alertDefinition
				cmd.RowsAffected = 0
				return nil
			}
			return err
		}

		alertDefinition.Version = existingAlertDefinition.Version + 1

		affectedRows, err := sess.ID(cmd.ID).Update(alertDefinition)
		if err != nil {
			return err
		}

		title := cmd.Title
		if title == "" {
			title = existingAlertDefinition.Title
		}
		condition := cmd.Condition.RefID
		if condition == "" {
			condition = existingAlertDefinition.Condition
		}
		data := cmd.Condition.QueriesAndExpressions
		if data == nil {
			data = existingAlertDefinition.Data
		}
		intervalSeconds := cmd.IntervalSeconds
		if intervalSeconds == nil {
			intervalSeconds = &existingAlertDefinition.IntervalSeconds
		}

		alertDefVersion := AlertDefinitionVersion{
			AlertDefinitionID:  alertDefinition.ID,
			AlertDefinitionUID: existingAlertDefinition.UID,
			ParentVersion:      existingAlertDefinition.Version,
			Version:            alertDefinition.Version,
			Condition:          condition,
			Created:            alertDefinition.Updated,
			Title:              title,
			Data:               data,
			IntervalSeconds:    *intervalSeconds,
		}
		if _, err := sess.Insert(alertDefVersion); err != nil {
			return err
		}

		cmd.Result = alertDefinition
		cmd.RowsAffected = affectedRows
		return nil
	})
}

// getOrgAlertDefinitions is a handler for retrieving alert definitions of specific organisation.
func (ng *AlertNG) getOrgAlertDefinitions(query *listAlertDefinitionsQuery) error {
	return ng.SQLStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		alertDefinitions := make([]*AlertDefinition, 0)
		q := "SELECT * FROM alert_definition WHERE org_id = ?"
		if err := sess.SQL(q, query.OrgID).Find(&alertDefinitions); err != nil {
			return err
		}

		query.Result = alertDefinitions
		return nil
	})
}

func (ng *AlertNG) getAlertDefinitions(query *listAlertDefinitionsQuery) error {
	return ng.SQLStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		alerts := make([]*AlertDefinition, 0)
		q := "SELECT id, interval_seconds, version FROM alert_definition"
		if err := sess.SQL(q).Find(&alerts); err != nil {
			return err
		}

		query.Result = alerts
		return nil
	})
}

func generateNewAlertDefinitionUID(sess *sqlstore.DBSession, orgID int64) (string, error) {
	for i := 0; i < 3; i++ {
		uid := util.GenerateShortUID()

		exists, err := sess.Where("org_id=? AND uid=?", orgID, uid).Get(&AlertDefinition{})
		if err != nil {
			return "", err
		}

		if !exists {
			return uid, nil
		}
	}

	return "", errAlertDefinitionFailedGenerateUniqueUID
}
