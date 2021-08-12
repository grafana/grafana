package store

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

var (
	// ErrNoAlertmanagerConfiguration is an error for when no alertmanager configuration is found.
	ErrNoAlertmanagerConfiguration = fmt.Errorf("could not find an Alertmanager configuration")
)

// GetLatestAlertmanagerConfiguration returns the lastest version of the alertmanager configuration.
// It returns ErrNoAlertmanagerConfiguration if no configuration is found.
func (st *DBstore) GetLatestAlertmanagerConfiguration(query *models.GetLatestAlertmanagerConfigurationQuery) error {
	return st.SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		c := &models.AlertConfiguration{}
		// The ID is already an auto incremental column, using the ID as an order should guarantee the latest.
		ok, err := sess.Desc("id").Where("org_id = ?", query.OrgID).Limit(1).Get(c)
		if err != nil {
			return err
		}

		if !ok {
			return ErrNoAlertmanagerConfiguration
		}

		query.Result = c
		return nil
	})
}

// SaveAlertmanagerConfiguration creates an alertmanager configuration.
func (st DBstore) SaveAlertmanagerConfiguration(cmd *models.SaveAlertmanagerConfigurationCmd) error {
	return st.SaveAlertmanagerConfigurationWithCallback(cmd, func() error { return nil })
}

type SaveCallback func() error

// SaveAlertmanagerConfigurationWithCallback creates an alertmanager configuration version and then executes a callback.
// If the callback results in error in rollsback the transaction.
func (st DBstore) SaveAlertmanagerConfigurationWithCallback(cmd *models.SaveAlertmanagerConfigurationCmd, callback SaveCallback) error {
	return st.SQLStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		config := models.AlertConfiguration{
			AlertmanagerConfiguration: cmd.AlertmanagerConfiguration,
			ConfigurationVersion:      cmd.ConfigurationVersion,
			Default:                   cmd.Default,
			OrgID:                     cmd.OrgID,
		}
		if _, err := sess.Insert(config); err != nil {
			return err
		}

		if err := callback(); err != nil {
			return err
		}

		return nil
	})
}
