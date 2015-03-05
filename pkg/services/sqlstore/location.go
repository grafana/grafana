package sqlstore

import (
	"github.com/go-xorm/xorm"
	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
	"strconv"
	"time"
)

func init() {
	bus.AddHandler("sql", GetLocations)
	bus.AddHandler("sql", GetLocationById)
	bus.AddHandler("sql", AddLocation)
	bus.AddHandler("sql", UpdateLocation)
	bus.AddHandler("sql", DeleteLocation)
}

func GetLocationById(query *m.GetLocationByIdQuery) error {
	sess := x.Limit(100, 0).Where("(public=1 OR org_id=?) AND id=?", query.OrgId, query.Id)
	has, err := sess.Get(&query.Result)

	if !has {
		return m.ErrLocationNotFound
	}
	return err
}

func GetLocations(query *m.GetLocationsQuery) error {
	sess := x.Limit(100, 0).Where("public=1 OR org_id=?", query.OrgId).Asc("name")

	if len(query.LocationId) > 0 {
		if len(query.LocationId) > 1 {
			sess.In("id", query.LocationId)
		} else {
			sess.And("id=?", query.LocationId[0])
		}
	}
	if len(query.Country) > 0 {
		if len(query.Country) > 1 {
			sess.In("country", query.Country)
		} else {
			sess.And("country=?", query.Country[0])
		}
	}
	if len(query.Name) > 0 {
		if len(query.Name) > 1 {
			sess.In("name", query.Name)
		} else {
			sess.And("name=?", query.Name[0])
		}
	}
	if len(query.Region) > 0 {
		if len(query.Region) > 1 {
			sess.In("region", query.Region)
		} else {
			sess.And("region=?", query.Region[0])
		}
	}
	if len(query.Provider) > 0 {
		if len(query.Provider) > 1 {
			sess.In("provider", query.Provider)
		} else {
			sess.And("provider=?", query.Provider[0])
		}
	}
	if len(query.Slug) > 0 {
		if len(query.Slug) > 1 {
			sess.In("slug", query.Slug)
		} else {
			sess.And("slug=?", query.Slug[0])
		}
	}
	if query.Public != "" {
		if p, err := strconv.ParseBool(query.Public); err == nil {
			sess.And("public=?", p)
		} else {
			return err
		}
	}

	query.Result = make([]*m.Location, 0)

	return sess.Find(&query.Result)
}

func DeleteLocation(cmd *m.DeleteLocationCommand) error {
	return inTransaction(func(sess *xorm.Session) error {
		var rawSql = "DELETE FROM location WHERE id=? and org_id=?"
		_, err := sess.Exec(rawSql, cmd.Id, cmd.OrgId)
		return err
	})
}

func AddLocation(cmd *m.AddLocationCommand) error {

	return inTransaction(func(sess *xorm.Session) error {
		l := &m.Location{
			OrgId:    cmd.OrgId,
			Name:     cmd.Name,
			Country:  cmd.Country,
			Region:   cmd.Region,
			Provider: cmd.Provider,
			Public:   cmd.Public,
			Created:  time.Now(),
			Updated:  time.Now(),
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
			Id:       cmd.Id,
			OrgId:    cmd.OrgId,
			Name:     cmd.Name,
			Country:  cmd.Country,
			Region:   cmd.Region,
			Provider: cmd.Provider,
			Public:   cmd.Public,
			Updated:  time.Now(),
		}
		l.UpdateLocationSlug()
		_, err := sess.Where("id=? and org_id=?", l.Id, l.OrgId).Update(l)
		return err
	})
}
