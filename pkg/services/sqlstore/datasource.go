package sqlstore

import (
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/securejsondata"
	"github.com/grafana/grafana/pkg/metrics"
	m "github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandler("sql", GetDataSources)
	bus.AddHandler("sql", AddDataSource)
	bus.AddHandler("sql", DeleteDataSourceById)
	bus.AddHandler("sql", DeleteDataSourceByName)
	bus.AddHandler("sql", UpdateDataSource)
	bus.AddHandler("sql", GetDataSourceById)
	bus.AddHandler("sql", GetDataSourceByName)
}

func GetDataSourceById(query *m.GetDataSourceByIdQuery) error {
	metrics.M_DB_DataSource_QueryById.Inc()

	datasource := m.DataSource{OrgId: query.OrgId, Id: query.Id}
	has, err := x.Get(&datasource)

	if !has {
		return m.ErrDataSourceNotFound
	}

	query.Result = &datasource
	return err
}

func GetDataSourceByName(query *m.GetDataSourceByNameQuery) error {
	datasource := m.DataSource{OrgId: query.OrgId, Name: query.Name}
	has, err := x.Get(&datasource)

	if !has {
		return m.ErrDataSourceNotFound
	}

	query.Result = &datasource
	return err
}

func GetDataSources(query *m.GetDataSourcesQuery) error {
	sess := x.Limit(1000, 0).Where("org_id=?", query.OrgId).Asc("name")

	query.Result = make([]*m.DataSource, 0)
	return sess.Find(&query.Result)
}

func DeleteDataSourceById(cmd *m.DeleteDataSourceByIdCommand) error {
	return inTransaction(func(sess *DBSession) error {
		var rawSql = "DELETE FROM data_source WHERE id=? and org_id=?"
		_, err := sess.Exec(rawSql, cmd.Id, cmd.OrgId)
		return err
	})
}

func DeleteDataSourceByName(cmd *m.DeleteDataSourceByNameCommand) error {
	return inTransaction(func(sess *DBSession) error {
		var rawSql = "DELETE FROM data_source WHERE name=? and org_id=?"
		_, err := sess.Exec(rawSql, cmd.Name, cmd.OrgId)
		return err
	})
}

func AddDataSource(cmd *m.AddDataSourceCommand) error {

	return inTransaction(func(sess *DBSession) error {
		existing := m.DataSource{OrgId: cmd.OrgId, Name: cmd.Name}
		has, _ := sess.Get(&existing)

		if has {
			return m.ErrDataSourceNameExists
		}

		ds := &m.DataSource{
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

func updateIsDefaultFlag(ds *m.DataSource, sess *DBSession) error {
	// Handle is default flag
	if ds.IsDefault {
		rawSql := "UPDATE data_source SET is_default=? WHERE org_id=? AND id <> ?"
		if _, err := sess.Exec(rawSql, false, ds.OrgId, ds.Id); err != nil {
			return err
		}
	}
	return nil
}

func UpdateDataSource(cmd *m.UpdateDataSourceCommand) error {

	return inTransaction(func(sess *DBSession) error {
		ds := &m.DataSource{
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
			Version:           cmd.Version + 1,
		}

		sess.UseBool("is_default")
		sess.UseBool("basic_auth")
		sess.UseBool("with_credentials")

		_, err := sess.Where("id=? and org_id=?", ds.Id, ds.OrgId).Update(ds)
		if err != nil {
			return err
		}

		err = updateIsDefaultFlag(ds, sess)
		return err
	})
}
