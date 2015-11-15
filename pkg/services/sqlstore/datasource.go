package sqlstore

import (
	"time"

	"github.com/wangy1931/grafana/pkg/bus"
	m "github.com/wangy1931/grafana/pkg/models"

	"github.com/go-xorm/xorm"
)

func init() {
	bus.AddHandler("sql", GetDataSources)
	bus.AddHandler("sql", AddDataSource)
	bus.AddHandler("sql", DeleteDataSource)
	bus.AddHandler("sql", UpdateDataSource)
	bus.AddHandler("sql", GetDataSourceById)
	bus.AddHandler("sql", GetDataSourceByName)
}

func GetDataSourceById(query *m.GetDataSourceByIdQuery) error {
	sess := x.Limit(100, 0).Where("org_id=? AND id=?", query.OrgId, query.Id)
	has, err := sess.Get(&query.Result)

	if !has {
		return m.ErrDataSourceNotFound
	}
	return err
}

func GetDataSourceByName(query *m.GetDataSourceByNameQuery) error {
	sess := x.Limit(100, 0).Where("org_id=? AND name=?", query.OrgId, query.Name)
	has, err := sess.Get(&query.Result)

	if !has {
		return m.ErrDataSourceNotFound
	}
	return err
}

func GetDataSources(query *m.GetDataSourcesQuery) error {
	sess := x.Limit(100, 0).Where("org_id=?", query.OrgId).Asc("name")

	query.Result = make([]*m.DataSource, 0)
	return sess.Find(&query.Result)
}

func DeleteDataSource(cmd *m.DeleteDataSourceCommand) error {
	return inTransaction(func(sess *xorm.Session) error {
		var rawSql = "DELETE FROM data_source WHERE id=? and org_id=?"
		_, err := sess.Exec(rawSql, cmd.Id, cmd.OrgId)
		return err
	})
}

func AddDataSource(cmd *m.AddDataSourceCommand) error {

	return inTransaction(func(sess *xorm.Session) error {
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
			JsonData:          cmd.JsonData,
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

func updateIsDefaultFlag(ds *m.DataSource, sess *xorm.Session) error {
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

	return inTransaction(func(sess *xorm.Session) error {
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
			JsonData:          cmd.JsonData,
			Updated:           time.Now(),
		}

		sess.UseBool("is_default")
		sess.UseBool("basic_auth")

		_, err := sess.Where("id=? and org_id=?", ds.Id, ds.OrgId).Update(ds)
		if err != nil {
			return err
		}

		err = updateIsDefaultFlag(ds, sess)
		return err
	})
}
