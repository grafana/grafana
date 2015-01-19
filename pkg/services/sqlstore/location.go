package sqlstore

import (
	"github.com/go-xorm/xorm"
	"github.com/torkelo/grafana-pro/pkg/bus"
	m "github.com/torkelo/grafana-pro/pkg/models"
	"time"
	"fmt"
	"strconv"
	"errors"
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

func marshalString(value string) (interface{}, error) {
	return value, nil
}

func marshalInt(value string) (interface{}, error) {
	return strconv.ParseInt(value, 0, 64)
}

func marshalBool(value string) (interface{}, error) {
	return strconv.ParseBool(value)
}

func marshalFilters(target string, values []string) ([]interface{}, error) {

	VALIDFILTERS := map[string]func(string)(interface{}, error){
		"id": marshalInt,
		"slug": marshalString,
		"name": marshalString,
		"country": marshalString,
		"region": marshalString,
		"provider": marshalString,
		"public": marshalBool,
	}

	f, ok := VALIDFILTERS[target]
	if ok {
		response := make([]interface{}, 0)
		if len(values) > 1 {
			for _, v := range values {
				if value, err := f(v); err == nil {
					response = append(response, value)
				}
			}
		} else if len(values) == 1 {
			if value, err := f(values[0]); err == nil {
				response = append(response, value)
			}
		}
		if len(response) > 0 {
			return response, nil
		}
	}
	return nil, errors.New("invalid filter target")
}

func GetLocations(query *m.GetLocationsQuery) error {
	sess := x.Limit(100, 0).Where("public=1 OR account_id=?", query.AccountId).Asc("name")

	for k,v := range query.Filter {
		values, err := marshalFilters(k, v)
		if err == nil {
			if len(values) > 1 {
				sess.In(k, values)
			} else if len(values) == 1 {
				sess.Where(fmt.Sprintf("%s=?", k), values[0])
			}
		}
	}

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
