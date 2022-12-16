package store

import (
	"context"
	"crypto/md5"
	"fmt"
	"time"

	"xorm.io/builder"
	"xorm.io/core"

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

// GetAllLatestAlertmanagerConfiguration returns the latest configuration of every organization
func (st *DBstore) GetAllLatestAlertmanagerConfiguration(ctx context.Context) ([]*models.AlertConfiguration, error) {
	var result []*models.AlertConfiguration
	err := st.SQLStore.WithDbSession(ctx, func(sess *db.Session) error {
		condition := builder.In("id", builder.Select("MAX(id)").From("alert_configuration").GroupBy("org_id"))
		if err := sess.Table("alert_configuration").Where(condition).Find(&result); err != nil {
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
		}
		if _, err := sess.Insert(&config); err != nil {
			return err
		}

		if _, err := st.deleteOldConfigurations(ctx, cmd.OrgID, ConfigRecordsLimit); err != nil {
			st.Logger.Warn("failed to delete old am configs", "org", cmd.OrgID, "error", err)
		}
		if err := callback(); err != nil {
			return err
		}

		// After the callback succeeds, add the created ID to the command.
		cmd.ResultID = config.ID
		return nil
	})
}

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
		res, err := sess.Exec(fmt.Sprintf(getInsertQuery(st.SQLStore.GetDialect().DriverName()), st.SQLStore.GetDialect().Quote("default")),
			config.AlertmanagerConfiguration,
			config.ConfigurationHash,
			config.ConfigurationVersion,
			config.OrgID,
			config.CreatedAt,
			st.SQLStore.GetDialect().BooleanStr(config.Default),
			cmd.OrgID,
			cmd.OrgID,
			cmd.FetchedConfigurationHash,
		)
		if err != nil {
			return err
		}
		rows, err := res.RowsAffected()
		if err != nil {
			return err
		}
		if rows == 0 {
			return ErrVersionLockedObjectNotFound
		}
		if _, err := st.deleteOldConfigurations(ctx, cmd.OrgID, ConfigRecordsLimit); err != nil {
			st.Logger.Warn("failed to delete old am configs", "org", cmd.OrgID, "error", err)
		}
		return err
	})
}

func (st *DBstore) MarkAlertmanagerConfigurationAsSuccessfullyApplied(ctx context.Context, configurationID int64) error {
	return st.SQLStore.WithDbSession(ctx, func(sess *db.Session) error {
		res, err := sess.Exec("UPDATE alert_configuration SET successfully_applied = true WHERE id = ?", configurationID)
		if err != nil {
			return err
		}

		rowsAffected, err := res.RowsAffected()
		if err != nil {
			return err
		}

		if rowsAffected != 1 {
			return fmt.Errorf("update statement affected %d rows", rowsAffected)
		}

		return nil
	})
}

// GetSuccessfullyAppliedAlertmanagerConfigurations returns the latest n valid configurations for an org.
func (st *DBstore) GetSuccessfullyAppliedAlertmanagerConfigurations(ctx context.Context, query *models.GetSuccessfullyAppliedAlertmanagerConfigurationsQuery) error {
	var result []*models.AlertConfiguration
	return st.SQLStore.WithDbSession(ctx, func(sess *db.Session) error {
		err := sess.Table("alert_configuration").Where("org_id = ? AND successfully_applied = true", query.OrgID).Desc("id").Limit(query.Limit).Find(&result)
		if err != nil {
			return err
		}

		query.Result = result
		return nil
	})
}

// getInsertQuery is used to determinate the insert query for the alertmanager config
// based on the provided sql driver. This is necesarry as such an advanced query
// is not supported by our ORM and we need to generate it manually for each SQL dialect.
// We introduced this as part of a bug fix as the old approach wasn't working.
// Rel: https://github.com/grafana/grafana/issues/51356
func getInsertQuery(driver string) string {
	switch driver {
	case core.MYSQL:
		return `
		INSERT INTO alert_configuration
		(alertmanager_configuration, configuration_hash, configuration_version, org_id, created_at, %s) 
		SELECT T.* FROM (SELECT ? AS alertmanager_configuration,? AS configuration_hash,? AS configuration_version,? AS org_id,? AS created_at,? AS 'default') AS T
		WHERE
		EXISTS (
			SELECT 1 
			FROM alert_configuration 
			WHERE 
				org_id = ? 
			AND 
				id = (SELECT MAX(id) FROM alert_configuration WHERE org_id = ?) 
			AND 
				configuration_hash = ?
		)`
	case core.POSTGRES:
		return `
		INSERT INTO alert_configuration
		(alertmanager_configuration, configuration_hash, configuration_version, org_id, created_at, %s) 
		SELECT T.* FROM (VALUES($1,$2,$3,$4::bigint,$5::integer,$6::boolean)) AS T
		WHERE
		EXISTS (
			SELECT 1 
			FROM alert_configuration 
			WHERE 
				org_id = $7 
			AND 
				id = (SELECT MAX(id) FROM alert_configuration WHERE org_id = $8::bigint) 
			AND 
				configuration_hash = $9
		)`
	case core.SQLITE:
		return `
		INSERT INTO alert_configuration
		(alertmanager_configuration, configuration_hash, configuration_version, org_id, created_at, %s) 
		SELECT T.* FROM (VALUES(?,?,?,?,?,?)) AS T
		WHERE
		EXISTS (
			SELECT 1 
			FROM alert_configuration 
			WHERE 
				org_id = ? 
			AND 
				id = (SELECT MAX(id) FROM alert_configuration WHERE org_id = ?) 
			AND 
				configuration_hash = ?
		)`
	default:
		// SQLite version
		return `
		INSERT INTO alert_configuration
		(alertmanager_configuration, configuration_hash, configuration_version, org_id, created_at, %s) 
		SELECT T.* FROM (VALUES(?,?,?,?,?,?)) AS T
		WHERE
		EXISTS (
			SELECT 1 
			FROM alert_configuration 
			WHERE 
				org_id = ? 
			AND 
				id = (SELECT MAX(id) FROM alert_configuration WHERE org_id = ?) 
			AND 
				configuration_hash = ?
		)`
	}
}

func (st *DBstore) deleteOldConfigurations(ctx context.Context, orgID int64, limit int) (int64, error) {
	if limit < 1 {
		return 0, fmt.Errorf("failed to delete old configurations: limit is set to '%d' but needs to be > 0", limit)
	}

	var affectedRows int64
	err := st.SQLStore.WithDbSession(ctx, func(sess *db.Session) error {
		highest := &models.AlertConfiguration{}
		ok, err := sess.Desc("id").Where("org_id = ?", orgID).OrderBy("id").Limit(1, limit-1).Get(highest)
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
				alert_configuration 
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
