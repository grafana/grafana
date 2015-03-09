package sqlstore

import (
	"errors"
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
	Tag       string
	Latitude  float64
	Longitude float64
	Created   time.Time
	Updated   time.Time
}

func GetLocationById(query *m.GetLocationByIdQuery) error {
	result := make([]LocationWithTag, 0)
	sess := x.Table("location")
	sess.Join("LEFT", "location_tag", "location_tag.location_id=location.id")
	sess.Where("(location.public=1 OR location.org_id=?) AND location.id=? AND (location_tag.org_id = location.org_id OR location_tag.org_id=? OR location_tag.org_id is NULL)", query.OrgId, query.Id, query.OrgId)

	err := sess.Find(&result)

	if len(result) < 1 {
		return m.ErrLocationNotFound
	}

	tags := make([]string, 0)
	for _, row := range result {
		if row.Tag != "" {
			tags = append(tags, row.Tag)
		}
	}

	query.Result = &m.LocationDTO{
		Id:        result[0].Id,
		OrgId:     result[0].OrgId,
		Name:      result[0].Name,
		Slug:      result[0].Slug,
		Tags:      tags,
		Latitude:  result[0].Latitude,
		Longitude: result[0].Longitude,
	}

	return err
}

func GetLocations(query *m.GetLocationsQuery) error {
	result := make([]LocationWithTag, 0)
	sess := x.Table("location")
	sess.Join("LEFT", "location_tag", "location_tag.location_id=location.id")
	sess.Where("(location.public=1 OR location.org_id=?) AND (location_tag.org_id = location.org_id OR location_tag.org_id=? OR location_tag.org_id is NULL)", query.OrgId, query.OrgId)

	if len(query.Tag) > 0 {
		// this is a bit complicated because we want to
		// match only locations that have the tag(s),
		// but we still need to return all of the tags that
		// the location has.
		sess.Join("LEFT", []string{"location_tag", "lt"}, "lt.location_id = location.id")
		if len(query.Tag) > 1 {
			sess.In("lt.tag", query.Tag)
		} else {
			sess.And("lt.tag=?", query.Tag[0])
		}
	}
	if len(query.Name) > 0 {
		if len(query.Name) > 1 {
			sess.In("name", query.Name)
		} else {
			sess.And("name=?", query.Name[0])
		}
	}
	if query.Public != "" {
		if p, err := strconv.ParseBool(query.Public); err == nil {
			sess.And("public=?", p)
		} else {
			return err
		}
	}

	err := sess.Find(&result)
	if err != nil {
		return err
	}

	locations := make(map[int64]*m.LocationDTO)

	//iterate through all of the results and build out our locations model.
	for _, row := range result {
		if _, ok := locations[row.Id]; ok != true {
			//this is the first time we have seen this endpointId
			locationTags := make([]string, 0)
			locations[row.Id] = &m.LocationDTO{
				Id:        row.Id,
				OrgId:     row.OrgId,
				Name:      row.Name,
				Slug:      row.Slug,
				Latitude:  row.Latitude,
				Longitude: row.Longitude,
				Tags:      locationTags,
			}
		}
		if row.Tag != "" {
			locations[row.Id].Tags = append(locations[row.Id].Tags, row.Tag)
		}
	}

	query.Result = make([]*m.LocationDTO, len(locations))
	count := 0
	for _, v := range locations {
		query.Result[count] = v
		count++
	}
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
