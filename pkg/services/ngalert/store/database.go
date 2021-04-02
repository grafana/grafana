package store

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/services/ngalert/models"

	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/util"
)

// TimeNow makes it possible to test usage of time
var TimeNow = time.Now

// AlertDefinitionMaxTitleLength is the maximum length of the alert definition title
const AlertDefinitionMaxTitleLength = 190

// ErrEmptyTitleError is an error returned if the alert definition title is empty
var ErrEmptyTitleError = errors.New("title is empty")

// Store is the interface for persisting alert definitions and instances
type Store interface {
	DeleteAlertDefinitionByUID(*models.DeleteAlertDefinitionByUIDCommand) error
	GetAlertDefinitionByUID(*models.GetAlertDefinitionByUIDQuery) error
	GetAlertDefinitions(*models.ListAlertDefinitionsQuery) error
	GetOrgAlertDefinitions(*models.ListAlertDefinitionsQuery) error
	SaveAlertDefinition(*models.SaveAlertDefinitionCommand) error
	UpdateAlertDefinition(*models.UpdateAlertDefinitionCommand) error
	GetAlertInstance(*models.GetAlertInstanceQuery) error
	ListAlertInstances(*models.ListAlertInstancesQuery) error
	SaveAlertInstance(*models.SaveAlertInstanceCommand) error
	ValidateAlertDefinition(*models.AlertDefinition, bool) error
	UpdateAlertDefinitionPaused(*models.UpdateAlertDefinitionPausedCommand) error
	FetchOrgIds(cmd *models.FetchUniqueOrgIdsQuery) error
}

// AlertingStore is the database interface used by the Alertmanager service.
type AlertingStore interface {
	GetLatestAlertmanagerConfiguration(*models.GetLatestAlertmanagerConfigurationQuery) error
	GetAlertmanagerConfiguration(*models.GetAlertmanagerConfigurationQuery) error
	SaveAlertmanagerConfiguration(*models.SaveAlertmanagerConfigurationCmd) error
}

// DBstore stores the alert definitions and instances in the database.
type DBstore struct {
	// the base scheduler tick rate; it's used for validating definition interval
	BaseInterval time.Duration
	// default alert definiiton interval
	DefaultIntervalSeconds int64
	SQLStore               *sqlstore.SQLStore `inject:""`
}

func getAlertDefinitionByUID(sess *sqlstore.DBSession, alertDefinitionUID string, orgID int64) (*models.AlertDefinition, error) {
	// we consider optionally enabling some caching
	alertDefinition := models.AlertDefinition{OrgID: orgID, UID: alertDefinitionUID}
	has, err := sess.Get(&alertDefinition)
	if !has {
		return nil, models.ErrAlertDefinitionNotFound
	}
	if err != nil {
		return nil, err
	}
	return &alertDefinition, nil
}

// DeleteAlertDefinitionByUID is a handler for deleting an alert definition.
// It returns models.ErrAlertDefinitionNotFound if no alert definition is found for the provided ID.
func (st DBstore) DeleteAlertDefinitionByUID(cmd *models.DeleteAlertDefinitionByUIDCommand) error {
	return st.SQLStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
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

// GetAlertDefinitionByUID is a handler for retrieving an alert definition from that database by its UID and organisation ID.
// It returns models.ErrAlertDefinitionNotFound if no alert definition is found for the provided ID.
func (st DBstore) GetAlertDefinitionByUID(query *models.GetAlertDefinitionByUIDQuery) error {
	return st.SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		alertDefinition, err := getAlertDefinitionByUID(sess, query.UID, query.OrgID)
		if err != nil {
			return err
		}
		query.Result = alertDefinition
		return nil
	})
}

// SaveAlertDefinition is a handler for saving a new alert definition.
func (st DBstore) SaveAlertDefinition(cmd *models.SaveAlertDefinitionCommand) error {
	return st.SQLStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		intervalSeconds := st.DefaultIntervalSeconds
		if cmd.IntervalSeconds != nil {
			intervalSeconds = *cmd.IntervalSeconds
		}

		var initialVersion int64 = 1

		uid, err := generateNewAlertDefinitionUID(sess, cmd.OrgID)
		if err != nil {
			return fmt.Errorf("failed to generate UID for alert definition %q: %w", cmd.Title, err)
		}

		alertDefinition := &models.AlertDefinition{
			OrgID:           cmd.OrgID,
			Title:           cmd.Title,
			Condition:       cmd.Condition,
			Data:            cmd.Data,
			IntervalSeconds: intervalSeconds,
			Version:         initialVersion,
			UID:             uid,
		}

		if err := st.ValidateAlertDefinition(alertDefinition, false); err != nil {
			return err
		}

		if err := alertDefinition.PreSave(TimeNow); err != nil {
			return err
		}

		if _, err := sess.Insert(alertDefinition); err != nil {
			if st.SQLStore.Dialect.IsUniqueConstraintViolation(err) && strings.Contains(err.Error(), "title") {
				return fmt.Errorf("an alert definition with the title '%s' already exists: %w", cmd.Title, err)
			}
			return err
		}

		alertDefVersion := models.AlertDefinitionVersion{
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

// UpdateAlertDefinition is a handler for updating an existing alert definition.
// It returns models.ErrAlertDefinitionNotFound if no alert definition is found for the provided ID.
func (st DBstore) UpdateAlertDefinition(cmd *models.UpdateAlertDefinitionCommand) error {
	return st.SQLStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		existingAlertDefinition, err := getAlertDefinitionByUID(sess, cmd.UID, cmd.OrgID)
		if err != nil {
			if errors.Is(err, models.ErrAlertDefinitionNotFound) {
				return nil
			}
			return err
		}

		title := cmd.Title
		if title == "" {
			title = existingAlertDefinition.Title
		}
		condition := cmd.Condition
		if condition == "" {
			condition = existingAlertDefinition.Condition
		}
		data := cmd.Data
		if data == nil {
			data = existingAlertDefinition.Data
		}
		intervalSeconds := cmd.IntervalSeconds
		if intervalSeconds == nil {
			intervalSeconds = &existingAlertDefinition.IntervalSeconds
		}

		// explicitly set all fields regardless of being provided or not
		alertDefinition := &models.AlertDefinition{
			ID:              existingAlertDefinition.ID,
			Title:           title,
			Condition:       condition,
			Data:            data,
			OrgID:           existingAlertDefinition.OrgID,
			IntervalSeconds: *intervalSeconds,
			UID:             existingAlertDefinition.UID,
		}

		if err := st.ValidateAlertDefinition(alertDefinition, true); err != nil {
			return err
		}

		if err := alertDefinition.PreSave(TimeNow); err != nil {
			return err
		}

		alertDefinition.Version = existingAlertDefinition.Version + 1

		_, err = sess.ID(existingAlertDefinition.ID).Update(alertDefinition)
		if err != nil {
			if st.SQLStore.Dialect.IsUniqueConstraintViolation(err) && strings.Contains(err.Error(), "title") {
				return fmt.Errorf("an alert definition with the title '%s' already exists: %w", cmd.Title, err)
			}
			return err
		}

		alertDefVersion := models.AlertDefinitionVersion{
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

// GetOrgAlertDefinitions is a handler for retrieving alert definitions of specific organisation.
func (st DBstore) GetOrgAlertDefinitions(query *models.ListAlertDefinitionsQuery) error {
	return st.SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		alertDefinitions := make([]*models.AlertDefinition, 0)
		q := "SELECT * FROM alert_definition WHERE org_id = ?"
		if err := sess.SQL(q, query.OrgID).Find(&alertDefinitions); err != nil {
			return err
		}

		query.Result = alertDefinitions
		return nil
	})
}

// GetAlertDefinitions returns alert definition identifier, interval, version and pause state
// that are useful for it's scheduling.
func (st DBstore) GetAlertDefinitions(query *models.ListAlertDefinitionsQuery) error {
	return st.SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		alerts := make([]*models.AlertDefinition, 0)
		q := "SELECT uid, org_id, interval_seconds, version, paused FROM alert_definition"
		if err := sess.SQL(q).Find(&alerts); err != nil {
			return err
		}

		query.Result = alerts
		return nil
	})
}

// UpdateAlertDefinitionPaused update the pause state of an alert definition.
func (st DBstore) UpdateAlertDefinitionPaused(cmd *models.UpdateAlertDefinitionPausedCommand) error {
	return st.SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		if len(cmd.UIDs) == 0 {
			return nil
		}
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
		if resultCount, err := res.RowsAffected(); err == nil {
			cmd.ResultCount = resultCount
		}
		return nil
	})
}

func generateNewAlertDefinitionUID(sess *sqlstore.DBSession, orgID int64) (string, error) {
	for i := 0; i < 3; i++ {
		uid := util.GenerateShortUID()

		exists, err := sess.Where("org_id=? AND uid=?", orgID, uid).Get(&models.AlertDefinition{})
		if err != nil {
			return "", err
		}

		if !exists {
			return uid, nil
		}
	}

	return "", models.ErrAlertDefinitionFailedGenerateUniqueUID
}

// ValidateAlertDefinition validates the alert definition interval and organisation.
// If requireData is true checks that it contains at least one alert query
func (st DBstore) ValidateAlertDefinition(alertDefinition *models.AlertDefinition, requireData bool) error {
	if !requireData && len(alertDefinition.Data) == 0 {
		return fmt.Errorf("no queries or expressions are found")
	}

	if alertDefinition.Title == "" {
		return ErrEmptyTitleError
	}

	if alertDefinition.IntervalSeconds%int64(st.BaseInterval.Seconds()) != 0 {
		return fmt.Errorf("invalid interval: %v: interval should be divided exactly by scheduler interval: %v", time.Duration(alertDefinition.IntervalSeconds)*time.Second, st.BaseInterval)
	}

	// enfore max name length in SQLite
	if len(alertDefinition.Title) > AlertDefinitionMaxTitleLength {
		return fmt.Errorf("name length should not be greater than %d", AlertDefinitionMaxTitleLength)
	}

	if alertDefinition.OrgID == 0 {
		return fmt.Errorf("no organisation is found")
	}

	return nil
}
