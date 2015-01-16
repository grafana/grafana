package sqlstore

import (
	"github.com/go-xorm/xorm"
	"github.com/torkelo/grafana-pro/pkg/bus"
	m "github.com/torkelo/grafana-pro/pkg/models"
	"time"
)

func init() {
	bus.AddHandler("sql", GetLocations)
	bus.AddHandler("sql", GetLocationBySlug)
	bus.AddHandler("sql", AddLocation)
	bus.AddHandler("sql", UpdateLocation)
	bus.AddHandler("sql", DeleteLocation)
}

func GetLocationBySlug(query *m.GetLocationBySlugQuery) error {
	sess := x.Limit(100, 0).Where("(public=1 OR account_id=?) AND slug=?", query.AccountId, query.Slug)
	has, err := sess.Get(&query.Result)

	if !has {
		return m.ErrLocationNotFound
	}
	return err
}

func GetLocations(query *m.GetLocationsQuery) error {
	sess := x.Limit(100, 0).Where("public=1 OR account_id=?", query.AccountId).Asc("name")

	query.Result = make([]*m.Location, 0)
	return sess.Find(&query.Result)
}

func DeleteLocation(cmd *m.DeleteLocationCommand) error {
	return inTransaction(func(sess *xorm.Session) error {
		var rawSql = "DELETE FROM location WHERE id=? and account_id=?"
		_, err := sess.Exec(rawSql, cmd.Id, cmd.AccountId)
		return err
	})
}

func AddLocation(cmd *m.AddLocationCommand) error {
	
	return inTransaction(func(sess *xorm.Session) error {
		l := &m.Location{
			AccountId: cmd.AccountId,
			Name:      cmd.Name,
			Country:   cmd.Country,
			Region:    cmd.Region,
			Provider:  cmd.Provider,
			Public:    cmd.Public,
			Created:   time.Now(),
			Updated:   time.Now(),
		}
		l.UpdateLocationSlug()
		if _, err := sess.Insert(l); err != nil {
			return err
		}
		cmd.Result = l
		return nil
	})
}

func UpdateLocation(cmd *m.UpdateLocationCommand) error {

	return inTransaction(func(sess *xorm.Session) error {
		l := &m.Location{
			Id:        cmd.Id,
			AccountId: cmd.AccountId,
			Name:      cmd.Name,
			Country:   cmd.Country,
			Region:    cmd.Region,
			Provider:  cmd.Provider,
			Public:    cmd.Public,
			Updated:   time.Now(),
		}
		l.UpdateLocationSlug()
		_, err := sess.Where("id=? and account_id=?", l.Id, l.AccountId).Update(l)
		return err
	})
}
