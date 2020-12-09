package ngalert

import (
	"context"
	"errors"
	"time"

	"github.com/grafana/grafana/pkg/services/sqlstore"
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
		intervalInSeconds := defaultIntervalInSeconds
		if cmd.IntervalInSeconds != nil {
			intervalInSeconds = *cmd.IntervalInSeconds
		}

		var initialVersion int64 = 1
		alertDefinition := &AlertDefinition{
			OrgID:     cmd.OrgID,
			Name:      cmd.Name,
			Condition: cmd.Condition.RefID,
			Data:      cmd.Condition.QueriesAndExpressions,
			Interval:  intervalInSeconds,
			Version:   initialVersion,
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
			AlertDefinitionID: alertDefinition.ID,
			Version:           alertDefinition.Version,
			Created:           time.Unix(alertDefinition.Updated, 0),
			Name:              alertDefinition.Name,
			Data:              alertDefinition.Data,
			Interval:          alertDefinition.Interval,
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
			Name:      cmd.Name,
			Condition: cmd.Condition.RefID,
			Data:      cmd.Condition.QueriesAndExpressions,
		}
		if cmd.IntervalInSeconds != nil {
			alertDefinition.Interval = *cmd.IntervalInSeconds
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

		alertDefVersion := AlertDefinitionVersion{
			AlertDefinitionID: alertDefinition.ID,
			ParentVersion:     existingAlertDefinition.Version,
			Version:           alertDefinition.Version,
			Created:           time.Unix(alertDefinition.Updated, 0),
			Name:              alertDefinition.Name,
			Data:              alertDefinition.Data,
			Interval:          alertDefinition.Interval,
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
		q := "SELECT id, interval, version FROM alert_definition"
		if err := sess.SQL(q).Find(&alerts); err != nil {
			return err
		}

		query.Result = alerts
		return nil
	})
}
