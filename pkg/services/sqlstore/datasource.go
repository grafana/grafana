package sqlstore

import (
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/util/errutil"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"

	"xorm.io/xorm"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/securejsondata"
	"github.com/grafana/grafana/pkg/infra/metrics"
)

func init() {
	bus.AddHandler("sql", GetDataSources)
	bus.AddHandler("sql", GetDataSource)
	bus.AddHandler("sql", AddDataSource)
	bus.AddHandler("sql", DeleteDataSource)
	bus.AddHandler("sql", UpdateDataSource)
	bus.AddHandler("sql", GetDefaultDataSource)
}

// GetDataSource returns a datasource by org_id and either uid (preferred), id, or name.
// Zero values (0, or "") should be used for the parameters that will not be queried.
func (ss *SQLStore) GetDataSource(uid string, id int64, name string, orgID int64) (*models.DataSource, error) {
	query := &models.GetDataSourceQuery{
		Id:    id,
		Uid:   uid,
		Name:  name,
		OrgId: orgID,
	}

	if err := GetDataSource(query); err != nil {
		return nil, err
	}

	return query.Result, nil
}

// GetDataSource adds a datasource to the query model by querying by org_id as well as
// either uid (preferred), id, or name and is added to the bus.
func GetDataSource(query *models.GetDataSourceQuery) error {
	metrics.MDBDataSourceQueryByID.Inc()
	if query.OrgId == 0 || (query.Id == 0 && len(query.Name) == 0 && len(query.Uid) == 0) {
		return models.ErrDataSourceIdentifierNotSet
	}

	datasource := models.DataSource{Name: query.Name, OrgId: query.OrgId, Id: query.Id, Uid: query.Uid}
	has, err := x.Get(&datasource)

	if err != nil {
		sqlog.Error("Failed getting data source", "err", err, "uid", query.Uid, "id", query.Id, "name", query.Name, "orgId", query.OrgId)
		return err
	} else if !has {
		return models.ErrDataSourceNotFound
	}

	query.Result = &datasource
	return nil
}

func GetDataSources(query *models.GetDataSourcesQuery) error {
	var sess *xorm.Session
	if query.DataSourceLimit <= 0 {
		sess = x.Where("org_id=?", query.OrgId).Asc("name")
	} else {
		sess = x.Limit(query.DataSourceLimit, 0).Where("org_id=?", query.OrgId).Asc("name")
	}
	query.Result = make([]*models.DataSource, 0)
	return sess.Find(&query.Result)
}

// GetDefaultDataSource is used to get the default datasource of organization
func GetDefaultDataSource(query *models.GetDefaultDataSourceQuery) error {
	datasource := models.DataSource{}

	exists, err := x.Where("org_id=? AND is_default=?", query.OrgId, true).Get(&datasource)

	if !exists {
		return models.ErrDataSourceNotFound
	}

	query.Result = &datasource
	return err
}

// DeleteDataSource deletes a datasource by org_id and either uid (preferred), id, or name.
// Zero values (0, or "") should be used for the parameters that will not be queried.
func (ss *SQLStore) DeleteDataSource(uid string, id int64, name string, orgID int64) (int64, error) {
	cmd := &models.DeleteDataSourceCommand{
		ID:    id,
		UID:   uid,
		Name:  name,
		OrgID: orgID,
	}

	if err := DeleteDataSource(cmd); err != nil {
		return 0, err
	}

	return cmd.DeletedDatasourcesCount, nil
}

// DeleteDataSource removes a datasource by org_id as well as either uid (preferred), id, or name
// and is added to the bus.
func DeleteDataSource(cmd *models.DeleteDataSourceCommand) error {
	params := make([]interface{}, 0)

	makeQuery := func(sql string, p ...interface{}) {
		params = append(params, sql)
		params = append(params, p...)
	}

	switch {
	case cmd.OrgID == 0:
		return models.ErrDataSourceIdentifierNotSet
	case cmd.UID != "":
		makeQuery("DELETE FROM data_source WHERE uid=? and org_id=?", cmd.UID, cmd.OrgID)
	case cmd.ID != 0:
		makeQuery("DELETE FROM data_source WHERE id=? and org_id=?", cmd.ID, cmd.OrgID)
	case cmd.Name != "":
		makeQuery("DELETE FROM data_source WHERE name=? and org_id=?", cmd.Name, cmd.OrgID)
	default:
		return models.ErrDataSourceIdentifierNotSet
	}

	return inTransaction(func(sess *DBSession) error {
		result, err := sess.Exec(params...)
		cmd.DeletedDatasourcesCount, _ = result.RowsAffected()
		return err
	})
}

func AddDataSource(cmd *models.AddDataSourceCommand) error {
	return inTransaction(func(sess *DBSession) error {
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
			SecureJsonData:    securejsondata.GetEncryptedJsonData(cmd.SecureJsonData),
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

func UpdateDataSource(cmd *models.UpdateDataSourceCommand) error {
	return inTransaction(func(sess *DBSession) error {
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
			SecureJsonData:    securejsondata.GetEncryptedJsonData(cmd.SecureJsonData),
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
