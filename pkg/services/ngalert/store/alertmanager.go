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

func getLatestAlertmanagerConfiguration(sess *sqlstore.DBSession) (*models.AlertConfiguration, error) {
	c := &models.AlertConfiguration{}
	// The ID is already an auto incremental column, using the ID as an order should guarantee the latest.
	ok, err := sess.Desc("id").Limit(1).Get(c)
	if err != nil {
		return nil, err
	}

	if !ok {
		return nil, ErrNoAlertmanagerConfiguration
	}

	return c, nil
}

// GetLatestAlertmanagerConfiguration returns the lastest version of the alertmanager configuration.
// It returns ErrNoAlertmanagerConfiguration if no configuration is found.
func (st *DBstore) GetLatestAlertmanagerConfiguration(query *models.GetLatestAlertmanagerConfigurationQuery) error {
	return st.SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		c, err := getLatestAlertmanagerConfiguration(sess)
		if err != nil {
			return err
		}
		query.Result = c
		return nil
	})
}

// SaveAlertmanagerConfiguration creates an alertmanager configuration.
func (st *DBstore) SaveAlertmanagerConfiguration(cmd *models.SaveAlertmanagerConfigurationCmd) error {
	return st.SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		config := models.AlertConfiguration{
			AlertmanagerConfiguration: cmd.AlertmanagerConfiguration,
			ConfigurationVersion:      cmd.ConfigurationVersion,
		}
		if _, err := sess.Insert(config); err != nil {
			return err
		}
		return nil
	})
}
