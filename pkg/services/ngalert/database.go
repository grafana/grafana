package ngalert

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/util"
)

func getAlertDefinitionByUID(sess *sqlstore.DBSession, alertDefinitionUID string, orgID int64) (*AlertDefinition, error) {
	// we consider optionally enabling some caching
	alertDefinition := AlertDefinition{OrgID: orgID, UID: alertDefinitionUID}
	has, err := sess.Get(&alertDefinition)
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
func (ng *AlertNG) deleteAlertDefinitionByUID(cmd *deleteAlertDefinitionByUIDCommand) error {
	return ng.SQLStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		_, err := sess.Exec("DELETE FROM alert_definition WHERE uid = ? AND org_id = ?", cmd.UID, cmd.OrgID)
		if err != nil {
			return err
		}

		_, err = sess.Exec("DELETE FROM alert_definition_version WHERE alert_definition_uid = ?", cmd.UID)
		if err != nil {
			return err
		}

		_, err = sess.Exec("DELETE FROM alert_instance WHERE def_org_id = ? AND def_uid = ?", cmd.OrgID, cmd.UID)
		if err != nil {
			return err
		}
		return nil
	})
}

// getAlertDefinitionByUID is a handler for retrieving an alert definition from that database by its UID and organisation ID.
// It returns models.ErrAlertDefinitionNotFound if no alert definition is found for the provided ID.
func (ng *AlertNG) getAlertDefinitionByUID(query *getAlertDefinitionByUIDQuery) error {
	return ng.SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		alertDefinition, err := getAlertDefinitionByUID(sess, query.UID, query.OrgID)
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
			if ng.SQLStore.Dialect.IsUniqueConstraintViolation(err) && strings.Contains(err.Error(), "title") {
				return fmt.Errorf("an alert definition with the title '%s' already exists: %w", cmd.Title, err)
			}
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
		existingAlertDefinition, err := getAlertDefinitionByUID(sess, cmd.UID, cmd.OrgID)
		if err != nil {
			if errors.Is(err, errAlertDefinitionNotFound) {
				return nil
			}
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

		// explicitly set all fields regardless of being provided or not
		alertDefinition := &AlertDefinition{
			ID:              existingAlertDefinition.ID,
			Title:           title,
			Condition:       condition,
			Data:            data,
			OrgID:           existingAlertDefinition.OrgID,
			IntervalSeconds: *intervalSeconds,
			UID:             existingAlertDefinition.UID,
		}

		if err := ng.validateAlertDefinition(alertDefinition, true); err != nil {
			return err
		}

		if err := alertDefinition.preSave(); err != nil {
			return err
		}

		alertDefinition.Version = existingAlertDefinition.Version + 1

		_, err = sess.ID(existingAlertDefinition.ID).Update(alertDefinition)
		if err != nil {
			if ng.SQLStore.Dialect.IsUniqueConstraintViolation(err) && strings.Contains(err.Error(), "title") {
				return fmt.Errorf("an alert definition with the title '%s' already exists: %w", cmd.Title, err)
			}
			return err
		}

		alertDefVersion := AlertDefinitionVersion{
			AlertDefinitionID:  alertDefinition.ID,
			AlertDefinitionUID: alertDefinition.UID,
			ParentVersion:      alertDefinition.Version,
			Version:            alertDefinition.Version,
			Condition:          alertDefinition.Condition,
			Created:            alertDefinition.Updated,
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

// getOrgAlertDefinitions is a handler for retrieving alert definitions of specific organisation.
func (ng *AlertNG) getOrgAlertDefinitions(query *listAlertDefinitionsQuery) error {
	return ng.SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
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
	return ng.SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		alerts := make([]*AlertDefinition, 0)
		q := "SELECT uid, org_id, interval_seconds, version, paused FROM alert_definition"
		if err := sess.SQL(q).Find(&alerts); err != nil {
			return err
		}

		query.Result = alerts
		return nil
	})
}

func (ng *AlertNG) updateAlertDefinitionPaused(cmd *updateAlertDefinitionPausedCommand) error {
	return ng.SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		placeHolders := strings.Builder{}
		const separator = ", "
		separatorVar := separator
		params := []interface{}{cmd.Paused, cmd.OrgID}
		for i, UID := range cmd.UIDs {
			if i == len(cmd.UIDs)-1 {
				separatorVar = ""
			}
			placeHolders.WriteString(fmt.Sprintf("?%s", separatorVar))
			params = append(params, UID)
		}
		sql := fmt.Sprintf("UPDATE alert_definition SET paused = ? WHERE org_id = ? AND uid IN (%s)", placeHolders.String())

		// prepend sql statement to params
		var i interface{}
		params = append(params, i)
		copy(params[1:], params[0:])
		params[0] = sql

		res, err := sess.Exec(params...)
		if err != nil {
			return err
		}
		if cmd.ResultCount, err = res.RowsAffected(); err != nil {
			ng.log.Debug("failed to get rows affected: %w", err)
		}
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
