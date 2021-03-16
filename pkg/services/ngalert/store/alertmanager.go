package store

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

var (
	// ErrNoAlertmanagerConfiguration is an error for when no alertmanager configuration is found.
	ErrNoAlertmanagerConfiguration = fmt.Errorf("could not find an alert configuration")
)

// GetLatestAlertmanagerConfiguration returns the lastest version of the alertmanager configuraiton.
// It returns ErrNoAlertmanagerConfiguration if no configuration is found.
func (st DBstore) GetLatestAlertmanagerConfiguration(cmd *models.GetLatestAlertmanagerConfigurationQuery) error {
	return st.SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		c := &models.AlertConfiguration{}
		// The ID is already an auto incremental column, using the ID as an order should guarantee the latest.
		ok, err := sess.Desc("id").Limit(1).Get(c)
		if err != nil {
			return err
		}

		if !ok {
			return ErrNoAlertmanagerConfiguration
		}

		cmd.Result = c
		return nil
	})
}
