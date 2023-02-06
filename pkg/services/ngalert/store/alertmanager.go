package store

import (
	"context"
	"crypto/md5"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

var (
	// ErrNoAlertmanagerConfiguration is an error for when no alertmanager configuration is found.
	ErrNoAlertmanagerConfiguration = fmt.Errorf("could not find an Alertmanager configuration")
	// ErrVersionLockedObjectNotFound is returned when an object is not
	// found using the current hash.
	ErrVersionLockedObjectNotFound = fmt.Errorf("could not find object using provided id and hash")
	// ConfigRecordsLimit defines the limit of how many alertmanager configuration versions
	// should be stored in the database for each organization including the current one.
	// Has to be > 0
	ConfigRecordsLimit int = 100
)

// GetLatestAlertmanagerConfiguration returns the lastest version of the alertmanager configuration.
// It returns ErrNoAlertmanagerConfiguration if no configuration is found.
func (st *DBstore) GetLatestAlertmanagerConfiguration(ctx context.Context, query *models.GetLatestAlertmanagerConfigurationQuery) error {
	return st.SQLStore.WithDbSession(ctx, func(sess *db.Session) error {
		c := &models.AlertConfiguration{}
		// The ID is already an auto incremental column, using the ID as an order should guarantee the latest.
		ok, err := sess.Table("alert_configuration").Where("org_id = ?", query.OrgID).Get(c)
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

// GetAllLatestAlertmanagerConfiguration returns the latest configuration of every organization
func (st *DBstore) GetAllLatestAlertmanagerConfiguration(ctx context.Context) ([]*models.AlertConfiguration, error) {
	var result []*models.AlertConfiguration
	err := st.SQLStore.WithDbSession(ctx, func(sess *db.Session) error {
		if err := sess.Table("alert_configuration").Find(&result); err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

// SaveAlertmanagerConfiguration creates an alertmanager configuration.
func (st DBstore) SaveAlertmanagerConfiguration(ctx context.Context, cmd *models.SaveAlertmanagerConfigurationCmd) error {
	return st.SaveAlertmanagerConfigurationWithCallback(ctx, cmd, func() error { return nil })
}

type SaveCallback func() error

// SaveAlertmanagerConfigurationWithCallback creates an alertmanager configuration version and then executes a callback.
// If the callback results in error it rolls back the transaction.
func (st DBstore) SaveAlertmanagerConfigurationWithCallback(ctx context.Context, cmd *models.SaveAlertmanagerConfigurationCmd, callback SaveCallback) error {
	return st.SQLStore.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		config := models.AlertConfiguration{
			AlertmanagerConfiguration: cmd.AlertmanagerConfiguration,
			ConfigurationHash:         fmt.Sprintf("%x", md5.Sum([]byte(cmd.AlertmanagerConfiguration))),
			ConfigurationVersion:      cmd.ConfigurationVersion,
			Default:                   cmd.Default,
			OrgID:                     cmd.OrgID,
			CreatedAt:                 time.Now().Unix(),
		}

		// TODO: If we are more structured around how we seed configurations in the future, this can be a pure update instead of upsert. This should improve perf and code clarity.
		upsertSQL := st.SQLStore.GetDialect().UpsertSQL(
			"alert_configuration",
			[]string{"org_id"},
			[]string{"alertmanager_configuration", "configuration_version", "created_at", "default", "org_id", "configuration_hash"},
		)
		params := append(make([]interface{}, 0), cmd.AlertmanagerConfiguration, cmd.ConfigurationVersion, config.CreatedAt, config.Default, config.OrgID, config.ConfigurationHash)
		if _, err := sess.SQL(upsertSQL, params...).Query(); err != nil {
			return err
		}

		historicConfig := models.HistoricConfigFromAlertConfig(config)
		historicConfig.LastApplied = cmd.LastApplied
		if _, err := sess.Table("alert_configuration_history").Insert(historicConfig); err != nil {
			return err
		}

		if _, err := st.deleteOldConfigurations(ctx, cmd.OrgID, ConfigRecordsLimit); err != nil {
			st.Logger.Warn("failed to delete old am configs", "org", cmd.OrgID, "error", err)
		}

		if err := callback(); err != nil {
			return err
		}

		return nil
	})
}

// UpdateAlertmanagerConfiguration replaces an alertmanager configuration with optimistic locking. It assumes that an existing revision of the configuration exists in the store, and will return an error otherwise.
func (st *DBstore) UpdateAlertmanagerConfiguration(ctx context.Context, cmd *models.SaveAlertmanagerConfigurationCmd) error {
	return st.SQLStore.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		config := models.AlertConfiguration{
			AlertmanagerConfiguration: cmd.AlertmanagerConfiguration,
			ConfigurationHash:         fmt.Sprintf("%x", md5.Sum([]byte(cmd.AlertmanagerConfiguration))),
			ConfigurationVersion:      cmd.ConfigurationVersion,
			Default:                   cmd.Default,
			OrgID:                     cmd.OrgID,
			CreatedAt:                 time.Now().Unix(),
		}
		rows, err := sess.Table("alert_configuration").
			Where("org_id = ? AND configuration_hash = ?", config.OrgID, cmd.FetchedConfigurationHash).
			Update(config)
		if err != nil {
			return err
		}
		if rows == 0 {
			return ErrVersionLockedObjectNotFound
		}

		historicConfig := models.HistoricConfigFromAlertConfig(config)
		if _, err := sess.Table("alert_configuration_history").Insert(historicConfig); err != nil {
			return err
		}
		if _, err := st.deleteOldConfigurations(ctx, cmd.OrgID, ConfigRecordsLimit); err != nil {
			st.Logger.Warn("failed to delete old am configs", "org", cmd.OrgID, "error", err)
		}
		return nil
	})
}

// MarkConfigurationAsApplied sets the `last_applied` field of the last config with the given hash to the current UNIX timestamp.
func (st *DBstore) MarkConfigurationAsApplied(ctx context.Context, cmd *models.MarkConfigurationAsAppliedCmd) error {
	return st.SQLStore.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		update := map[string]interface{}{"last_applied": time.Now().UTC().Unix()}
		rowsAffected, err := sess.Table("alert_configuration_history").
			Desc("id").
			Limit(1).
			Where("org_id = ? AND configuration_hash = ?", cmd.OrgID, cmd.ConfigurationHash).
			Cols("last_applied").
			Update(&update)

		if err != nil {
			return err
		}

		if rowsAffected != 1 {
			st.Logger.Warn("Unexpected number of rows updating alert configuration history", "rows", rowsAffected, "org", cmd.OrgID, "hash", cmd.ConfigurationHash)
		}

		return nil
	})
}

// GetAppliedConfigurations returns all configurations that have been marked as applied, ordered newest -> oldest by id.
func (st *DBstore) GetAppliedConfigurations(ctx context.Context, query *models.GetAppliedConfigurationsQuery) error {
	return st.SQLStore.WithDbSession(ctx, func(sess *db.Session) error {
		cfgs := []*models.HistoricAlertConfiguration{}
		err := sess.Table("alert_configuration_history").
			Desc("id").
			Where("org_id = ? AND last_applied != 0", query.OrgID).
			Find(&cfgs)

		if err != nil {
			return err
		}

		query.Result = cfgs
		return nil
	})
}

func (st *DBstore) deleteOldConfigurations(ctx context.Context, orgID int64, limit int) (int64, error) {
	if limit < 1 {
		return 0, fmt.Errorf("failed to delete old configurations: limit is set to '%d' but needs to be > 0", limit)
	}

	if limit < 1 {
		limit = ConfigRecordsLimit
	}

	var affectedRows int64
	err := st.SQLStore.WithDbSession(ctx, func(sess *db.Session) error {
		highest := &models.HistoricAlertConfiguration{}
		ok, err := sess.Table("alert_configuration_history").Desc("id").Where("org_id = ?", orgID).OrderBy("id").Limit(1, limit-1).Get(highest)
		if err != nil {
			return err
		}
		if !ok {
			// No configurations exist. Nothing to clean up.
			affectedRows = 0
			return nil
		}

		threshold := highest.ID - 1
		if threshold < 1 {
			// Fewer than `limit` records even exist. Nothing to clean up.
			affectedRows = 0
			return nil
		}

		res, err := sess.Exec(`
			DELETE FROM 
				alert_configuration_history
			WHERE
				org_id = ?
			AND 
				id < ?
		`, orgID, threshold)
		if err != nil {
			return err
		}
		rows, err := res.RowsAffected()
		if err != nil {
			return err
		}
		affectedRows = rows
		if affectedRows > 0 {
			st.Logger.Info("deleted old alert_configuration(s)", "org", orgID, "limit", limit, "delete_count", affectedRows)
		}
		return nil
	})
	return affectedRows, err
}
