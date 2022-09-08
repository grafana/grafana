package service

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/events"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
)

type SqlxStore struct {
	sess    *session.SessionDB
	dialect migrator.Dialect
	logger  log.Logger
}

// GetDataSource adds a datasource to the query model by querying by org_id as well as
// either uid (preferred), id, or name and is added to the bus.
func (ss *SqlxStore) GetDataSource(ctx context.Context, query *datasources.GetDataSourceQuery) error {
	metrics.MDBDataSourceQueryByID.Inc()
	return getDataSourceSQLx(ctx, query, ss.sess, ss.logger)
}

func getDataSourceSQLx(ctx context.Context, query *datasources.GetDataSourceQuery, sess session.Session, logger log.Logger) error {
	if query.OrgId == 0 || (query.Id == 0 && len(query.Name) == 0 && len(query.Uid) == 0) {
		return datasources.ErrDataSourceIdentifierNotSet
	}
	// Here datasource could be get by org_id which is mandatory, and one of the following Id/Name/Uid
	ds := datasources.DataSource{}
	var err error
	if len(query.Uid) != 0 {
		err = sess.Get(ctx, &ds, "SELECT * from data_source where org_id=? and uid=?", query.OrgId, query.Uid)
	} else if len(query.Name) != 0 {
		err = sess.Get(ctx, &ds, "SELECT * from data_source where org_id=? and name=?", query.OrgId, query.Name)
	} else {
		err = sess.Get(ctx, &ds, "SELECT * from data_source where org_id=? and id=?", query.OrgId, query.Id)
	}

	if err != nil {
		logger.Error("Failed getting data source", "err", err, "uid", query.Uid, "id", query.Id, "name", query.Name, "orgId", query.OrgId)
		if errors.Is(err, sql.ErrNoRows) {
			return datasources.ErrDataSourceNotFound
		}
		return err
	}

	query.Result = &ds
	return nil
}

func (ss *SqlxStore) GetDataSources(ctx context.Context, query *datasources.GetDataSourcesQuery) error {
	query.Result = make([]*datasources.DataSource, 0)
	var err error
	if query.DataSourceLimit <= 0 {
		err = ss.sess.Select(ctx, &query.Result, "SELECT * FROM data_source WHERE org_id=? ORDER BY name ASC", query.OrgId)
	} else {
		err = ss.sess.Select(ctx, &query.Result, "SELECT * FROM data_source WHERE org_id=? ORDER BY name ASC LIMIT ?", query.OrgId, query.DataSourceLimit)
	}
	return err
}

func (ss *SqlxStore) GetAllDataSources(ctx context.Context, query *datasources.GetAllDataSourcesQuery) error {
	query.Result = make([]*datasources.DataSource, 0)
	return ss.sess.Select(ctx, query.Result, "SELECT * FROM data_source ORDER BY name ASC")
}

// GetDataSourcesByType returns all datasources for a given type or an error if the specified type is an empty string
func (ss *SqlxStore) GetDataSourcesByType(ctx context.Context, query *datasources.GetDataSourcesByTypeQuery) error {
	if query.Type == "" {
		return fmt.Errorf("datasource type cannot be empty")
	}

	query.Result = make([]*datasources.DataSource, 0)
	var err error
	if query.OrgId > 0 {
		err = ss.sess.Select(ctx, &query.Result, "SELECT * FROM data_source WHERE type=? AND org_id=? ORDER BY id ASC", query.Type, query.OrgId)
	} else {
		err = ss.sess.Select(ctx, &query.Result, "SELECT * FROM data_source WHERE type=? ORDER BY id ASC", query.Type)
	}
	return err
}

// GetDefaultDataSource is used to get the default datasource of organization
func (ss *SqlxStore) GetDefaultDataSource(ctx context.Context, query *datasources.GetDefaultDataSourceQuery) error {
	query.Result = &datasources.DataSource{}
	err := ss.sess.Get(ctx, query.Result, "SELECT * FROM data_source WHERE org_id=? AND is_default=?", query.OrgId, true)
	if err != nil && errors.Is(err, sql.ErrNoRows) {
		return datasources.ErrDataSourceNotFound
	}
	return err
}

func updateIsDefaultFlagSQLx(ctx context.Context, ds *datasources.DataSource, sess session.Session) error {
	// Handle is default flag
	if ds.IsDefault {
		rawSQL := "UPDATE data_source SET is_default=? WHERE org_id=? AND id <> ?"
		if _, err := sess.Exec(ctx, rawSQL, false, ds.OrgId, ds.Id); err != nil {
			return err
		}
	}
	return nil
}

func (ss *SqlxStore) generateNewDatasourceUid(ctx context.Context, orgId int64) (string, error) {
	for i := 0; i < 3; i++ {
		uid := generateNewUid()
		ds := datasources.DataSource{}
		err := ss.sess.Get(ctx, &ds, "SELECT * FROM data_source WHERE org_id=? AND uid=?", orgId, uid)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return uid, nil
			}
			return "", err
		}
	}

	return "", datasources.ErrDataSourceFailedGenerateUniqueUid
}

func (ss *SqlxStore) AddDataSource(ctx context.Context, cmd *datasources.AddDataSourceCommand) error {
	// Check datasource is not already exist
	ds := datasources.DataSource{}
	err := ss.sess.Get(ctx, &ds, "SELECT * FROM data_source WHERE org_id = ? AND name = ?", cmd.OrgId, cmd.Name)
	if err != nil {
		if !errors.Is(err, sql.ErrNoRows) {
			return err
		}
	} else {
		return datasources.ErrDataSourceNameExists
	}

	if cmd.JsonData == nil {
		cmd.JsonData = simplejson.New()
	}

	if cmd.SecureJsonData == nil {
		cmd.SecureJsonData = make(map[string]string)
	}

	if cmd.Uid == "" {
		uid, err := ss.generateNewDatasourceUid(ctx, cmd.OrgId)
		if err != nil {
			return fmt.Errorf("failed to generate UID for datasource %q: %w", cmd.Name, err)
		}
		cmd.Uid = uid
	}

	secureJson := datasources.SecureData(cmd.EncryptedSecureJsonData)
	err = ss.sess.WithTransaction(ctx, func(sess *session.SessionTx) error {
		ds := &datasources.DataSource{
			OrgId:           cmd.OrgId,
			Name:            cmd.Name,
			Type:            cmd.Type,
			Access:          cmd.Access,
			Url:             cmd.Url,
			User:            cmd.User,
			Database:        cmd.Database,
			IsDefault:       cmd.IsDefault,
			BasicAuth:       cmd.BasicAuth,
			BasicAuthUser:   cmd.BasicAuthUser,
			WithCredentials: cmd.WithCredentials,
			JsonData:        cmd.JsonData,
			SecureJsonData:  &secureJson,
			Created:         time.Now(),
			Updated:         time.Now(),
			Version:         1,
			ReadOnly:        cmd.ReadOnly,
			Uid:             cmd.Uid,
		}

		secureJsonData, err := ds.SecureJsonData.Value()
		if err != nil {
			return err
		}
		rawQuery :=
			`INSERT INTO data_source
			(org_id, version, type, name, access, url, user, database, basic_auth, basic_auth_user, is_default, json_data, with_credentials, secure_json_data, created, updated, read_only, uid) 
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		if ds.Id, err = ss.sess.ExecWithReturningId(
			ctx, rawQuery, ds.OrgId, ds.Version, ds.Type, ds.Name, ds.Access, ds.Url, ds.User, ds.Database, ds.BasicAuth, ds.BasicAuthUser, ds.IsDefault,
			ds.JsonData, ds.WithCredentials, secureJsonData, ds.Created, ds.Updated, ds.ReadOnly, ds.Uid); err != nil {
			if ss.dialect.IsUniqueConstraintViolation(err) && strings.Contains(strings.ToLower(ss.dialect.ErrorMessage(err)), "uid") {
				return datasources.ErrDataSourceUidExists
			}
			return err
		}
		if err := updateIsDefaultFlagSQLx(ctx, ds, sess); err != nil {
			return err
		}

		if cmd.UpdateSecretFn != nil {
			if err := cmd.UpdateSecretFn(); err != nil {
				ss.logger.Error("Failed to update datasource secrets -- rolling back update", "name", cmd.Name, "type", cmd.Type, "orgId", cmd.OrgId)
				return err
			}
		}

		cmd.Result = ds

		// have to find a way to publish after commit
		sess.PublishAfterCommit(&events.DataSourceCreated{
			Timestamp: time.Now(),
			Name:      cmd.Name,
			ID:        ds.Id,
			UID:       cmd.Uid,
			OrgID:     cmd.OrgId,
		})
		return nil
	})

	return err
}

// DeleteDataSource removes a datasource by org_id as well as either uid (preferred), id, or name
// and is added to the bus. It also removes permissions related to the datasource.
func (ss *SqlxStore) DeleteDataSource(ctx context.Context, cmd *datasources.DeleteDataSourceCommand) error {
	return ss.sess.WithTransaction(ctx, func(sess *session.SessionTx) error {
		dsQuery := &datasources.GetDataSourceQuery{Id: cmd.ID, Uid: cmd.UID, Name: cmd.Name, OrgId: cmd.OrgID}
		errGettingDS := getDataSourceSQLx(ctx, dsQuery, sess, ss.logger)

		if errGettingDS != nil && !errors.Is(errGettingDS, datasources.ErrDataSourceNotFound) {
			return errGettingDS
		}

		ds := dsQuery.Result
		if ds != nil {
			// Delete the data source
			result, err := sess.Exec(ctx, "DELETE FROM data_source WHERE org_id=? AND id=?", ds.OrgId, ds.Id)
			if err != nil {
				return err
			}

			cmd.DeletedDatasourcesCount, _ = result.RowsAffected()

			// Remove associated AccessControl permissions
			if _, errDeletingPerms := sess.Exec(ctx, "DELETE FROM permission WHERE scope=?",
				ac.Scope("datasources", "id", fmt.Sprint(dsQuery.Result.Id))); errDeletingPerms != nil {
				return errDeletingPerms
			}
		}

		if cmd.UpdateSecretFn != nil {
			if err := cmd.UpdateSecretFn(); err != nil {
				ss.logger.Error("Failed to update datasource secrets -- rolling back update", "UID", cmd.UID, "name", cmd.Name, "orgId", cmd.OrgID)
				return err
			}
		}

		// Publish data source deletion event
		if cmd.DeletedDatasourcesCount > 0 {
			sess.PublishAfterCommit(&events.DataSourceDeleted{
				Timestamp: time.Now(),
				Name:      ds.Name,
				ID:        ds.Id,
				UID:       ds.Uid,
				OrgID:     ds.OrgId,
			})
		}

		return nil
	})
}

func (ss *SqlxStore) UpdateDataSource(ctx context.Context, cmd *datasources.UpdateDataSourceCommand) error {
	return ss.sess.WithTransaction(ctx, func(sess *session.SessionTx) error {
		if cmd.JsonData == nil {
			cmd.JsonData = simplejson.New()
		}

		secureJson := datasources.SecureData(cmd.EncryptedSecureJsonData)
		ds := &datasources.DataSource{
			Id:              cmd.Id,
			OrgId:           cmd.OrgId,
			Name:            cmd.Name,
			Type:            cmd.Type,
			Access:          cmd.Access,
			Url:             cmd.Url,
			User:            cmd.User,
			Database:        cmd.Database,
			IsDefault:       cmd.IsDefault,
			BasicAuth:       cmd.BasicAuth,
			BasicAuthUser:   cmd.BasicAuthUser,
			WithCredentials: cmd.WithCredentials,
			JsonData:        cmd.JsonData,
			SecureJsonData:  &secureJson,
			Updated:         time.Now(),
			ReadOnly:        cmd.ReadOnly,
			Version:         cmd.Version + 1,
			Uid:             cmd.Uid,
		}

		secureJsonData, err := ds.SecureJsonData.Value()
		if err != nil {
			return err
		}

		whereQuery := []string{"id=? and org_id=?"}
		var whereParams []interface{}
		whereParams = append(whereParams, ds.Id, ds.OrgId)
		if cmd.Version != 0 {
			// the reason we allow cmd.version > db.version is make it possible for people to force
			// updates to datasources using the datasource.yaml file without knowing exactly what version
			// a datasource have in the db.
			whereQuery = append(whereQuery, "version < ?")
			whereParams = append(whereParams, ds.Version)
		}
		whereStatment := strings.Join(whereQuery, " and ")

		query := fmt.Sprintf(`UPDATE data_source 
		SET id=?, org_id=?, name=?, type=?, access=?, url=?, user=?, database=?, is_default=?, basic_auth=?,
		basic_auth_user=?, with_credentials=?, json_data=?, secure_json_data=?, updated=?, read_only=?,
		version=?, uid=? 
		WHERE %s`, whereStatment)

		var args []interface{}
		args = append(args, ds.Id, ds.OrgId, ds.Name, ds.Type, ds.Access, ds.Url, ds.User, ds.Database, ds.IsDefault, ds.BasicAuth,
			ds.BasicAuthUser, ds.WithCredentials, ds.JsonData, secureJsonData, ds.Updated, ds.ReadOnly,
			ds.Version, ds.Uid)
		args = append(args, whereParams...)

		res, err := sess.Exec(
			ctx, query, args...)
		if err != nil {
			return err
		}

		affected, _ := res.RowsAffected()
		if affected == 0 {
			return datasources.ErrDataSourceUpdatingOldVersion
		}

		err = updateIsDefaultFlagSQLx(ctx, ds, sess)

		if cmd.UpdateSecretFn != nil {
			if err := cmd.UpdateSecretFn(); err != nil {
				ss.logger.Error("Failed to update datasource secrets -- rolling back update", "UID", cmd.Uid, "name", cmd.Name, "type", cmd.Type, "orgId", cmd.OrgId)
				return err
			}
		}

		cmd.Result = ds
		return err
	})
}
