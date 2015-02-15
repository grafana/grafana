package sqlstore

import (
	"time"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"

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
	sess := x.Limit(100, 0).Where("account_id=? AND id=?", query.AccountId, query.Id)
	has, err := sess.Get(&query.Result)

	if !has {
		return m.ErrDataSourceNotFound
	}
	return err
}

func GetDataSourceByName(query *m.GetDataSourceByNameQuery) error {
	sess := x.Limit(100, 0).Where("account_id=? AND name=?", query.AccountId, query.Name)
	has, err := sess.Get(&query.Result)

	if !has {
		return m.ErrDataSourceNotFound
	}
	return err
}

func GetDataSources(query *m.GetDataSourcesQuery) error {
	sess := x.Limit(100, 0).Where("account_id=?", query.AccountId).Asc("name")

	query.Result = make([]*m.DataSource, 0)
	return sess.Find(&query.Result)
}

func DeleteDataSource(cmd *m.DeleteDataSourceCommand) error {
	return inTransaction(func(sess *xorm.Session) error {
		var rawSql = "DELETE FROM data_source WHERE id=? and account_id=?"
		_, err := sess.Exec(rawSql, cmd.Id, cmd.AccountId)
		return err
	})
}

func AddDataSource(cmd *m.AddDataSourceCommand) error {

	return inTransaction(func(sess *xorm.Session) error {
		ds := &m.DataSource{
			AccountId: cmd.AccountId,
			Name:      cmd.Name,
			Type:      cmd.Type,
			Access:    cmd.Access,
			Url:       cmd.Url,
			User:      cmd.User,
			Password:  cmd.Password,
			Database:  cmd.Database,
			IsDefault: cmd.IsDefault,
			Created:   time.Now(),
			Updated:   time.Now(),
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
		rawSql := "UPDATE data_source SET is_default = 0 WHERE account_id=? AND id <> ?"
		if _, err := sess.Exec(rawSql, ds.AccountId, ds.Id); err != nil {
			return err
		}
	}
	return nil
}

func UpdateDataSource(cmd *m.UpdateDataSourceCommand) error {

	return inTransaction(func(sess *xorm.Session) error {
		ds := &m.DataSource{
			Id:        cmd.Id,
			AccountId: cmd.AccountId,
			Name:      cmd.Name,
			Type:      cmd.Type,
			Access:    cmd.Access,
			Url:       cmd.Url,
			User:      cmd.User,
			Password:  cmd.Password,
			Database:  cmd.Database,
			Updated:   time.Now(),
			IsDefault: cmd.IsDefault,
		}

		sess.UseBool("is_default")

		_, err := sess.Where("id=? and account_id=?", ds.Id, ds.AccountId).Update(ds)
		if err != nil {
			return err
		}

		err = updateIsDefaultFlag(ds, sess)
		return err
	})
}
