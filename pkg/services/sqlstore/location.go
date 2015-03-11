package sqlstore

import (
	"errors"
	"strings"
	"fmt"
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

type LocationWithTag struct {
	Id        int64
	OrgId     int64
	Name      string
	Slug      string
	Tags      string
	Latitude  float64
	Longitude float64
	Public    bool
	Created   time.Time
	Updated   time.Time
}

func GetLocationById(query *m.GetLocationByIdQuery) error {
	sess := x.Table("location")
	rawParams := make([]interface{}, 0)
	rawSql := `SELECT
		GROUP_CONCAT(DISTINCT(location_tag.tag)) as tags,
		location.*
	FROM location
	LEFT JOIN location_tag ON location.id = location_tag.location_id
	WHERE 
		(location.public=1 OR location.org_id=?) 
	AND
		location.id=?
	AND 
		(location_tag.org_id = location.org_id OR location_tag.org_id=? OR location_tag.id is NULL)
	GROUP BY location.id
	`
	rawParams = append(rawParams, query.OrgId, query.Id, query.OrgId)
	results := make([]LocationWithTag, 0)
	err := sess.Sql(rawSql, rawParams...).Find(&results)
	if err != nil {
		return err
	}
	if len(results) < 1 {
		return m.ErrLocationNotFound
	}

	result := results[0]

	tags := make([]string, 0)
	if result.Tags != "" {
		tags = strings.Split(result.Tags, ",")
	}

	query.Result = &m.LocationDTO{
		Id:        result.Id,
		OrgId:     result.OrgId,
		Name:      result.Name,
		Slug:      result.Slug,
		Tags:      tags,
		Latitude:  result.Latitude,
		Longitude: result.Longitude,
		Public:    result.Public,
	}

	return err
}

func GetLocations(query *m.GetLocationsQuery) error {
	sess := x.Table("location")
	rawParams := make([]interface{}, 0)
	rawSql := `SELECT
		GROUP_CONCAT(DISTINCT(location_tag.tag)) as tags,
		location.*
	FROM location
	LEFT JOIN location_tag ON location.id = location_tag.location_id
	`
	whereSql := make([]string, 0)
	whereSql = append(whereSql, "(location.public=1 OR location.org_id=?)","(location_tag.org_id = location.org_id OR location_tag.org_id=? OR location_tag.id is NULL)")
	rawParams = append(rawParams, query.OrgId, query.OrgId)

	if len(query.Tag) > 0 {
		// this is a bit complicated because we want to
		// match only locations that have the tag(s),
		// but we still need to return all of the tags that
		// the location has.
		rawSql += "LEFT JOIN location_tag AS lt ON lt.location_id = location.id\n"
		p := make([]string, len(query.Tag))
		for i, t := range query.Tag {
			p[i] = "?"
			rawParams = append(rawParams, t)
		}
		whereSql = append(whereSql, fmt.Sprintf("lt.tag IN (%s)", strings.Join(p, ",")))
	}
	if len(query.Name) > 0 {
		p := make([]string, len(query.Name))
		for i, t := range query.Name {
			p[i] = "?"
			rawParams = append(rawParams, t)
		}
		whereSql = append(whereSql, fmt.Sprintf("location.name IN (%s)", strings.Join(p, ",")))
	}
	if query.Public != "" {
		if p, err := strconv.ParseBool(query.Public); err == nil {
			whereSql = append(whereSql, "location.public=?")
			rawParams = append(rawParams, p)
		} else {
			return err
		}
	}

	rawSql += "WHERE " + strings.Join(whereSql, " AND ")
	rawSql += " GROUP BY location.id"

	result := make([]LocationWithTag, 0)
	err := sess.Sql(rawSql, rawParams...).Find(&result)
	if err != nil {
		return err
	}

	locations := make([]*m.LocationDTO, len(result))

	//iterate through all of the results and build out our locations model.
	for i, row := range result {
		tags := make([]string, 0)
		if row.Tags != "" {
			tags = strings.Split(row.Tags, ",")
		}
		locations[i] = &m.LocationDTO{
			Id:        row.Id,
			OrgId:     row.OrgId,
			Name:      row.Name,
			Slug:      row.Slug,
			Latitude:  row.Latitude,
			Longitude: row.Longitude,
			Tags:      tags,
			Public:    row.Public,
		}
	}

	query.Result = locations
	return nil
}

func DeleteLocation(cmd *m.DeleteLocationCommand) error {
	return inTransaction(func(sess *xorm.Session) error {
		//Query the location to make sure we own it.
		locationQuery := m.GetLocationByIdQuery{
			Id:    cmd.Id,
			OrgId: cmd.OrgId,
		}
		err := GetLocationById(&locationQuery)
		if err != nil {
			return err
		}
		if locationQuery.OrgId != cmd.OrgId {
			return errors.New("Permision Denined. You do not own this Location.")
		}

		var rawSql = "DELETE FROM location_tag WHERE location_id=?"
		if _, err := sess.Exec(rawSql, cmd.Id); err != nil {
			return err
		}
		rawSql = "DELETE FROM location WHERE id=?"
		if _, err := sess.Exec(rawSql, cmd.Id); err != nil {
			return err
		}
		return nil
	})
}

func AddLocation(cmd *m.AddLocationCommand) error {

	return inTransaction(func(sess *xorm.Session) error {
		l := &m.Location{
			OrgId:     cmd.OrgId,
			Name:      cmd.Name,
			Public:    cmd.Public,
			Latitude:  cmd.Latitude,
			Longitude: cmd.Longitude,
			Created:   time.Now(),
			Updated:   time.Now(),
		}
		l.UpdateLocationSlug()
		if _, err := sess.Insert(l); err != nil {
			return err
		}

		cmd.Result = &m.LocationDTO{
			Id:        l.Id,
			OrgId:     l.OrgId,
			Name:      l.Name,
			Slug:      l.Slug,
			Tags:      make([]string, 0),
			Latitude:  l.Latitude,
			Longitude: l.Longitude,
		}
		return nil
	})
}

func UpdateLocation(cmd *m.UpdateLocationCommand) error {

	return inTransaction(func(sess *xorm.Session) error {
		//Query the location to make sure we own it.
		locationQuery := m.GetLocationByIdQuery{
			Id:    cmd.Id,
			OrgId: cmd.OrgId,
		}
		err := GetLocationById(&locationQuery)
		if err != nil {
			return err
		}

		//the location can only be edited by those who own it.
		if locationQuery.Result.OrgId == cmd.OrgId {
			l := &m.Location{
				Id:        cmd.Id,
				OrgId:     cmd.OrgId,
				Latitude:  cmd.Latitude,
				Longitude: cmd.Longitude,
				Updated:   time.Now(),
			}
			_, err := sess.Where("id=? and org_id=?", l.Id, l.OrgId).Update(l)
			if err != nil {
				return err
			}
		}

		rawSql := "DELETE FROM location_tag WHERE location_id=? and org_id=?"
		if _, err := sess.Exec(rawSql, cmd.Id, cmd.OrgId); err != nil {
			return err
		}

		tagsMap := make(map[string]bool)
		if locationQuery.Result.Public && locationQuery.Result.OrgId != cmd.OrgId {
			ownerTags := make([]m.LocationTag, 0)
			sess.Table("location_tag")
			sess.Where("location_id=? AND org_id=?", cmd.Id, locationQuery.Result.OrgId)
			err = sess.Find(&ownerTags)

			for _, tag := range ownerTags {
				tagsMap[tag.Tag] = true
			}
		}

		locationTags := make([]m.LocationTag, 0, len(cmd.Tags))
		for _, tag := range cmd.Tags {
			//only add the Tag to the DB if the owner of the location
			// does not already have a tag with the same name.
			if _, ok := tagsMap[tag]; !ok {
				locationTags = append(locationTags, m.LocationTag{
					OrgId:      cmd.OrgId,
					LocationId: cmd.Id,
					Tag:        tag,
				})
			}
		}
		if len(locationTags) > 0 {
			sess.Table("location_tag")
			if _, err := sess.Insert(&locationTags); err != nil {
				return err
			}
		}

		return nil
	})
}
