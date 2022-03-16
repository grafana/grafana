package sqlstore

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/events"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/models"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/util/errutil"
	"xorm.io/xorm"
)

// GetDataSource adds a datasource to the query model by querying by org_id as well as
// either uid (preferred), id, or name and is added to the bus.
func (ss *SQLStore) GetDataSource(ctx context.Context, query *models.GetDataSourceQuery) error {
	metrics.MDBDataSourceQueryByID.Inc()

	return ss.WithDbSession(ctx, func(sess *DBSession) error {
		return ss.getDataSource(ctx, query, sess)
	})
}

func (ss *SQLStore) getDataSource(ctx context.Context, query *models.GetDataSourceQuery, sess *DBSession) error {
	if query.OrgId == 0 || (query.Id == 0 && len(query.Name) == 0 && len(query.Uid) == 0) {
		return models.ErrDataSourceIdentifierNotSet
	}

	datasource := &models.DataSource{Name: query.Name, OrgId: query.OrgId, Id: query.Id, Uid: query.Uid}
	has, err := sess.Get(datasource)

	if err != nil {
		sqlog.Error("Failed getting data source", "err", err, "uid", query.Uid, "id", query.Id, "name", query.Name, "orgId", query.OrgId)
		return err
	} else if !has {
		return models.ErrDataSourceNotFound
	}

	query.Result = datasource

	return nil
}

func (ss *SQLStore) GetDataSources(ctx context.Context, query *models.GetDataSourcesQuery) error {
	var sess *xorm.Session
	return ss.WithDbSession(ctx, func(dbSess *DBSession) error {
		if query.DataSourceLimit <= 0 {
			sess = dbSess.Where("org_id=?", query.OrgId).Asc("name")
		} else {
			sess = dbSess.Limit(query.DataSourceLimit, 0).Where("org_id=?", query.OrgId).Asc("name")
		}

		query.Result = make([]*models.DataSource, 0)
		return sess.Find(&query.Result)
	})
}

// GetDataSourcesByType returns all datasources for a given type or an error if the specified type is an empty string
func (ss *SQLStore) GetDataSourcesByType(ctx context.Context, query *models.GetDataSourcesByTypeQuery) error {
	if query.Type == "" {
		return fmt.Errorf("datasource type cannot be empty")
	}

	query.Result = make([]*models.DataSource, 0)
	return ss.WithDbSession(ctx, func(sess *DBSession) error {
		return sess.Where("type=?", query.Type).Asc("id").Find(&query.Result)
	})
}

// GetDefaultDataSource is used to get the default datasource of organization
func (ss *SQLStore) GetDefaultDataSource(ctx context.Context, query *models.GetDefaultDataSourceQuery) error {
	datasource := models.DataSource{}
	return ss.WithDbSession(ctx, func(sess *DBSession) error {
		exists, err := sess.Where("org_id=? AND is_default=?", query.OrgId, true).Get(&datasource)

		if !exists {
			return models.ErrDataSourceNotFound
		}

		query.Result = &datasource
		return err
	})
}

// DeleteDataSource removes a datasource by org_id as well as either uid (preferred), id, or name
// and is added to the bus. It also removes permissions related to the datasource.
func (ss *SQLStore) DeleteDataSource(ctx context.Context, cmd *models.DeleteDataSourceCommand) error {
	return ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
		dsQuery := &models.GetDataSourceQuery{Id: cmd.ID, Uid: cmd.UID, Name: cmd.Name, OrgId: cmd.OrgID}
		errGettingDS := ss.getDataSource(ctx, dsQuery, sess)

		if errGettingDS != nil && !errors.Is(errGettingDS, models.ErrDataSourceNotFound) {
			return errGettingDS
		}

		ds := dsQuery.Result
		if ds != nil {
			// Delete the data source
			result, err := sess.Exec("DELETE FROM data_source WHERE org_id=? AND id=?", ds.OrgId, ds.Id)
			if err != nil {
				return err
			}

			cmd.DeletedDatasourcesCount, _ = result.RowsAffected()

			// Remove associated AccessControl permissions
			if _, errDeletingPerms := sess.Exec("DELETE FROM permission WHERE scope=?",
				ac.Scope("datasources", "id", fmt.Sprint(dsQuery.Result.Id))); errDeletingPerms != nil {
				return errDeletingPerms
			}
		}

		// Publish data source deletion event
		sess.publishAfterCommit(&events.DataSourceDeleted{
			Timestamp: time.Now(),
			Name:      cmd.Name,
			ID:        cmd.ID,
			UID:       cmd.UID,
			OrgID:     cmd.OrgID,
		})

		return nil
	})
}

func (ss *SQLStore) AddDataSource(ctx context.Context, cmd *models.AddDataSourceCommand) error {
	return ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
		existing := models.DataSource{OrgId: cmd.OrgId, Name: cmd.Name}
		has, _ := sess.Get(&existing)

		if has {
			return models.ErrDataSourceNameExists
		}

		if cmd.JsonData == nil {
			cmd.JsonData = simplejson.New()
		}

		if cmd.Uid == "" {
			uid, err := generateNewDatasourceUid(sess, cmd.OrgId)
			if err != nil {
				return errutil.Wrapf(err, "Failed to generate UID for datasource %q", cmd.Name)
			}
			cmd.Uid = uid
		}

		ds := &models.DataSource{
			OrgId:             cmd.OrgId,
			Name:              cmd.Name,
			Type:              cmd.Type,
			Access:            cmd.Access,
			Url:               cmd.Url,
			User:              cmd.User,
			Password:          cmd.Password,
			Database:          cmd.Database,
			IsDefault:         cmd.IsDefault,
			BasicAuth:         cmd.BasicAuth,
			BasicAuthUser:     cmd.BasicAuthUser,
			BasicAuthPassword: cmd.BasicAuthPassword,
			WithCredentials:   cmd.WithCredentials,
			JsonData:          cmd.JsonData,
			SecureJsonData:    cmd.EncryptedSecureJsonData,
			Created:           time.Now(),
			Updated:           time.Now(),
			Version:           1,
			ReadOnly:          cmd.ReadOnly,
			Uid:               cmd.Uid,
		}

		if _, err := sess.Insert(ds); err != nil {
			if dialect.IsUniqueConstraintViolation(err) && strings.Contains(strings.ToLower(dialect.ErrorMessage(err)), "uid") {
				return models.ErrDataSourceUidExists
			}
			return err
		}
		if err := updateIsDefaultFlag(ds, sess); err != nil {
			return err
		}

		cmd.Result = ds

		sess.publishAfterCommit(&events.DataSourceCreated{
			Timestamp: time.Now(),
			Name:      cmd.Name,
			ID:        ds.Id,
			UID:       cmd.Uid,
			OrgID:     cmd.OrgId,
		})
		return nil
	})
}

func updateIsDefaultFlag(ds *models.DataSource, sess *DBSession) error {
	// Handle is default flag
	if ds.IsDefault {
		rawSQL := "UPDATE data_source SET is_default=? WHERE org_id=? AND id <> ?"
		if _, err := sess.Exec(rawSQL, false, ds.OrgId, ds.Id); err != nil {
			return err
		}
	}
	return nil
}

func (ss *SQLStore) UpdateDataSource(ctx context.Context, cmd *models.UpdateDataSourceCommand) error {
	return ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
		if cmd.JsonData == nil {
			cmd.JsonData = simplejson.New()
		}

		ds := &models.DataSource{
			Id:                cmd.Id,
			OrgId:             cmd.OrgId,
			Name:              cmd.Name,
			Type:              cmd.Type,
			Access:            cmd.Access,
			Url:               cmd.Url,
			User:              cmd.User,
			Password:          cmd.Password,
			Database:          cmd.Database,
			IsDefault:         cmd.IsDefault,
			BasicAuth:         cmd.BasicAuth,
			BasicAuthUser:     cmd.BasicAuthUser,
			BasicAuthPassword: cmd.BasicAuthPassword,
			WithCredentials:   cmd.WithCredentials,
			JsonData:          cmd.JsonData,
			SecureJsonData:    cmd.EncryptedSecureJsonData,
			Updated:           time.Now(),
			ReadOnly:          cmd.ReadOnly,
			Version:           cmd.Version + 1,
			Uid:               cmd.Uid,
		}

		sess.UseBool("is_default")
		sess.UseBool("basic_auth")
		sess.UseBool("with_credentials")
		sess.UseBool("read_only")
		// Make sure password are zeroed out if empty. We do this as we want to migrate passwords from
		// plain text fields to SecureJsonData.
		sess.MustCols("password")
		sess.MustCols("basic_auth_password")
		sess.MustCols("user")

		var updateSession *xorm.Session
		if cmd.Version != 0 {
			// the reason we allow cmd.version > db.version is make it possible for people to force
			// updates to datasources using the datasource.yaml file without knowing exactly what version
			// a datasource have in the db.
			updateSession = sess.Where("id=? and org_id=? and version < ?", ds.Id, ds.OrgId, ds.Version)
		} else {
			updateSession = sess.Where("id=? and org_id=?", ds.Id, ds.OrgId)
		}

		affected, err := updateSession.Update(ds)
		if err != nil {
			return err
		}

		if affected == 0 {
			return models.ErrDataSourceUpdatingOldVersion
		}

		err = updateIsDefaultFlag(ds, sess)

		cmd.Result = ds
		return err
	})
}

func (ss *SQLStore) UpdateDataSourceByUID(ctx context.Context, cmd *models.UpdateDataSourceCommand) error {
	return ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
		if cmd.JsonData == nil {
			cmd.JsonData = simplejson.New()
		}

		ds := &models.DataSource{
			Id:                cmd.Id,
			OrgId:             cmd.OrgId,
			Name:              cmd.Name,
			Type:              cmd.Type,
			Access:            cmd.Access,
			Url:               cmd.Url,
			User:              cmd.User,
			Password:          cmd.Password,
			Database:          cmd.Database,
			IsDefault:         cmd.IsDefault,
			BasicAuth:         cmd.BasicAuth,
			BasicAuthUser:     cmd.BasicAuthUser,
			BasicAuthPassword: cmd.BasicAuthPassword,
			WithCredentials:   cmd.WithCredentials,
			JsonData:          cmd.JsonData,
			SecureJsonData:    cmd.EncryptedSecureJsonData,
			Updated:           time.Now(),
			ReadOnly:          cmd.ReadOnly,
			Version:           cmd.Version + 1,
			Uid:               cmd.Uid,
		}

		sess.UseBool("is_default")
		sess.UseBool("basic_auth")
		sess.UseBool("with_credentials")
		sess.UseBool("read_only")
		// Make sure password are zeroed out if empty. We do this as we want to migrate passwords from
		// plain text fields to SecureJsonData.
		sess.MustCols("password")
		sess.MustCols("basic_auth_password")
		sess.MustCols("user")

		var updateSession *xorm.Session
		if cmd.Version != 0 {
			// the reason we allow cmd.version > db.version is make it possible for people to force
			// updates to datasources using the datasource.yaml file without knowing exactly what version
			// a datasource have in the db.
			updateSession = sess.Where("uid=? and org_id=? and version < ?", ds.Uid, ds.OrgId, ds.Version)
		} else {
			updateSession = sess.Where("uid=? and org_id=?", ds.Uid, ds.OrgId)
		}

		affected, err := updateSession.Update(ds)
		if err != nil {
			return err
		}

		if affected == 0 {
			return models.ErrDataSourceUpdatingOldVersion
		}

		if ds.IsDefault {
			rawSQL := "UPDATE data_source SET is_default=? WHERE org_id=? AND uid <> ?"
			if _, err := sess.Exec(rawSQL, false, ds.OrgId, ds.Uid); err != nil {
				return err
			}
		}

		cmd.Result = ds
		return err
	})
}

func generateNewDatasourceUid(sess *DBSession, orgId int64) (string, error) {
	for i := 0; i < 3; i++ {
		uid := generateNewUid()

		exists, err := sess.Where("org_id=? AND uid=?", orgId, uid).Get(&models.DataSource{})
		if err != nil {
			return "", err
		}

		if !exists {
			return uid, nil
		}
	}

	return "", models.ErrDataSourceFailedGenerateUniqueUid
}
