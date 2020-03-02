package sqlstore

import (
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"

	"github.com/go-xorm/xorm"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/securejsondata"
	"github.com/grafana/grafana/pkg/infra/metrics"
)

func init() {
	bus.AddHandler("sql", GetDataSources)
	bus.AddHandler("sql", GetAllDataSources)
	bus.AddHandler("sql", AddDataSource)
	bus.AddHandler("sql", DeleteDataSourceById)
	bus.AddHandler("sql", DeleteDataSourceByName)
	bus.AddHandler("sql", UpdateDataSource)
	bus.AddHandler("sql", GetDataSourceById)
	bus.AddHandler("sql", GetDataSourceByName)
}

func GetDataSourceById(query *models.GetDataSourceByIdQuery) error {
	metrics.MDBDataSourceQueryByID.Inc()

	datasource := models.DataSource{OrgId: query.OrgId, Id: query.Id}
	has, err := x.Get(&datasource)

	if err != nil {
		return err
	}

	if !has {
		return models.ErrDataSourceNotFound
	}

	query.Result = &datasource
	return err
}

func GetDataSourceByName(query *models.GetDataSourceByNameQuery) error {
	datasource := models.DataSource{OrgId: query.OrgId, Name: query.Name}
	has, err := x.Get(&datasource)

	if !has {
		return models.ErrDataSourceNotFound
	}

	query.Result = &datasource
	return err
}

func GetDataSources(query *models.GetDataSourcesQuery) error {
	sess := x.Limit(5000, 0).Where("org_id=?", query.OrgId).Asc("name")

	query.Result = make([]*models.DataSource, 0)
	return sess.Find(&query.Result)
}

func GetAllDataSources(query *models.GetAllDataSourcesQuery) error {
	sess := x.Limit(5000, 0).Asc("name")

	query.Result = make([]*models.DataSource, 0)
	return sess.Find(&query.Result)
}

func DeleteDataSourceById(cmd *models.DeleteDataSourceByIdCommand) error {
	return inTransaction(func(sess *DBSession) error {
		var rawSql = "DELETE FROM data_source WHERE id=? and org_id=?"
		result, err := sess.Exec(rawSql, cmd.Id, cmd.OrgId)
		affected, _ := result.RowsAffected()
		cmd.DeletedDatasourcesCount = affected
		return err
	})
}

func DeleteDataSourceByName(cmd *models.DeleteDataSourceByNameCommand) error {
	return inTransaction(func(sess *DBSession) error {
		var rawSql = "DELETE FROM data_source WHERE name=? and org_id=?"
		result, err := sess.Exec(rawSql, cmd.Name, cmd.OrgId)
		affected, _ := result.RowsAffected()
		cmd.DeletedDatasourcesCount = affected
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
		}

		if _, err := sess.Insert(ds); err != nil {
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
		rawSql := "UPDATE data_source SET is_default=? WHERE org_id=? AND id <> ?"
		if _, err := sess.Exec(rawSql, false, ds.OrgId, ds.Id); err != nil {
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
		}

		sess.UseBool("is_default")
		sess.UseBool("basic_auth")
		sess.UseBool("with_credentials")
		sess.UseBool("read_only")
		// Make sure password are zeroed out if empty. We do this as we want to migrate passwords from
		// plain text fields to SecureJsonData.
		sess.MustCols("password")
		sess.MustCols("basic_auth_password")

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
