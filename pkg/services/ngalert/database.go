package ngalert

import (
	"context"

	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func (ng *AlertNG) registerBusHandlers() {
	ng.Bus.AddHandler(ng.DeleteAlertDefinitionByID)
	ng.Bus.AddHandler(ng.SaveAlertDefinition)
	ng.Bus.AddHandler(ng.UpdateAlertDefinition)
	ng.Bus.AddHandler(ng.GetAlertDefinitionByID)
	ng.Bus.AddHandler(ng.GetAlertDefinitions)
}

func getAlertDefinitionByID(alertDefinitionID int64, sess *sqlstore.DBSession) (*AlertDefinition, error) {
	alertDefinition := AlertDefinition{}
	has, err := sess.ID(alertDefinitionID).Get(&alertDefinition)
	if !has {
		return nil, ErrAlertDefinitionNotFound
	}
	if err != nil {
		return nil, err
	}
	return &alertDefinition, nil
}

// DeleteAlertDefinitionByID handler for deleting an alert definition.
// It returns models.ErrAlertDefinitionNotFound if no alert definition is found for the provided ID.
func (ng *AlertNG) DeleteAlertDefinitionByID(query *DeleteAlertDefinitionByIDQuery) error {
	return ng.SQLStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		res, err := sess.Exec("DELETE FROM alert_definition WHERE id = ?", query.ID)
		if err != nil {
			return err
		}

		rowsAffected, err := res.RowsAffected()
		if err != nil {
			return err
		}
		query.RowsAffected = rowsAffected
		return nil
	})
}

// GetAlertDefinitionByID handler for retrieving an alert definition from that database by its ID.
// It returns models.ErrAlertDefinitionNotFound if no alert definition is found for the provided ID.
func (ng *AlertNG) GetAlertDefinitionByID(query *GetAlertDefinitionByIDQuery) error {
	return ng.SQLStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		alertDefinition, err := getAlertDefinitionByID(query.ID, sess)
		if err != nil {
			return err
		}
		query.Result = alertDefinition
		return nil
	})
}

// SaveAlertDefinition handler for saving a new alert definition.
func (ng *AlertNG) SaveAlertDefinition(cmd *SaveAlertDefinitionCommand) error {
	return ng.SQLStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		alertDefinition := &AlertDefinition{
			OrgId:     cmd.OrgID,
			Name:      cmd.Name,
			Condition: cmd.Condition.RefID,
			Data:      cmd.Condition.QueriesAndExpressions,
		}

		_, err := sess.Insert(alertDefinition)
		if err != nil {
			return err
		}

		cmd.Result = alertDefinition
		return nil
	})
}

// UpdateAlertDefinition handler for updatting an existing alert definition.
// It returns models.ErrAlertDefinitionNotFound if no alert definition is found for the provided ID.
func (ng *AlertNG) UpdateAlertDefinition(cmd *UpdateAlertDefinitionCommand) error {
	return ng.SQLStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		alertDefinition := &AlertDefinition{
			Name:      cmd.Name,
			Condition: cmd.Condition.RefID,
			Data:      cmd.Condition.QueriesAndExpressions,
		}
		affectedRows, err := sess.ID(cmd.ID).Update(alertDefinition)
		if err != nil {
			return err
		}

		cmd.Result = alertDefinition
		cmd.RowsAffected = affectedRows
		return nil
	})
}

// ListAlertDefinitions handler for retrieving alert definitions of specific organisation.
func (ng *AlertNG) GetAlertDefinitions(cmd *ListAlertDefinitionsCommand) error {
	return ng.SQLStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		alertDefinitions := make([]*AlertDefinition, 0)
		q := "SELECT * FROM alert_definition WHERE org_id = ?"
		if err := sess.SQL(q, cmd.OrgID).Find(&alertDefinitions); err != nil {
			return err
		}

		cmd.Result = alertDefinitions
		return nil
	})
}
