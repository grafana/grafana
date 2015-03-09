package sqlstore

import (
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/events"
	m "github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandler("sql", GetEndpoints)
	bus.AddHandler("sql", GetEndpointById)
	bus.AddHandler("sql", AddEndpoint)
	bus.AddHandler("sql", UpdateEndpoint)
	bus.AddHandler("sql", DeleteEndpoint)
}

type EndpointWithTag struct {
	Id      int64
	OrgId   int64
	Name    string
	Tag     string
	Created time.Time
	Updated time.Time
}

func GetEndpointById(query *m.GetEndpointByIdQuery) error {
	result := make([]EndpointWithTag, 0)
	sess := x.Table("endpoint")
	sess.Join("LEFT", "endpoint_tag", "endpoint_tag.endpoint_id=endpoint.id")
	sess.Where("endpoint.org_id=? AND endpoint.id=?", query.OrgId, query.Id)
	err := sess.Find(&result)

	if len(result) < 1 {
		return m.ErrEndpointNotFound
	}
	if err != nil {
		return err
	}
	tags := make([]string, 0)
	for _, row := range result {
		if row.Tag != "" {
			tags = append(tags, row.Tag)
		}
	}
	query.Result = &m.EndpointDTO{
		Id:    result[0].Id,
		OrgId: result[0].OrgId,
		Name:  result[0].Name,
		Tags:  tags,
	}
	return nil
}

func GetEndpoints(query *m.GetEndpointsQuery) error {
	result := make([]EndpointWithTag, 0)
	sess := x.Table("endpoint")
	sess.Join("LEFT", "endpoint_tag", "endpoint_tag.endpoint_id=endpoint.id")
	sess.Where("endpoint.org_id=?", query.OrgId).Asc("name")
	if len(query.Tag) > 0 {
		// this is a bit complicated because we want to
		// match only monitors that are enabled in the location,
		// but we still need to return all of the locations that
		// the monitor is enabled in.
		sess.Join("LEFT", []string{"endpoint_tag", "et"}, "et.endpoint_id = endpoint.id")
		if len(query.Tag) > 1 {
			sess.In("et.tag", query.Tag)
		} else {
			sess.And("et.tag=?", query.Tag[0])
		}
	}
	err := sess.Find(&result)
	if err != nil {
		return err
	}

	endpoints := make(map[int64]*m.EndpointDTO)
	//iterate through all of the results and build out our checks model.
	for _, row := range result {
		if _, ok := endpoints[row.Id]; ok != true {
			//this is the first time we have seen this endpointId
			endpointTags := make([]string, 0)
			endpoints[row.Id] = &m.EndpointDTO{
				Id:    row.Id,
				OrgId: row.OrgId,
				Name:  row.Name,
				Tags:  endpointTags,
			}
		}
		if row.Tag != "" {
			endpoints[row.Id].Tags = append(endpoints[row.Id].Tags, row.Tag)
		}
	}

	query.Result = make([]*m.EndpointDTO, len(endpoints))
	count := 0
	for _, v := range endpoints {
		query.Result[count] = v
		count++
	}
	return nil
}

func AddEndpoint(cmd *m.AddEndpointCommand) error {
	return inTransaction2(func(sess *session) error {
		endpoint := &m.Endpoint{
			OrgId:   cmd.OrgId,
			Name:    cmd.Name,
			Created: time.Now(),
			Updated: time.Now(),
		}

		if _, err := sess.Insert(endpoint); err != nil {
			return err
		}
		if len(cmd.Tags) > 0 {
			endpointTags := make([]m.EndpointTag, 0, len(cmd.Tags))
			for _, tag := range cmd.Tags {
				endpointTags = append(endpointTags, m.EndpointTag{
					OrgId:      cmd.OrgId,
					EndpointId: endpoint.Id,
					Tag:        tag,
				})
			}
			sess.Table("endpoint_tag")
			if _, err := sess.Insert(&endpointTags); err != nil {
				return err
			}
		}

		cmd.Result = &m.EndpointDTO{
			Id:    endpoint.Id,
			OrgId: endpoint.OrgId,
			Name:  endpoint.Name,
			Tags:  cmd.Tags,
		}
		sess.publishAfterCommit(&events.EndpointCreated{
			EndpointPayload: events.EndpointPayload{
				Id:    endpoint.Id,
				OrgId: endpoint.OrgId,
				Name:  endpoint.Name,
				Tags:  cmd.Tags,
			},
			Timestamp: endpoint.Updated,
		})
		return nil
	})
}

func UpdateEndpoint(cmd *m.UpdateEndpointCommand) error {
	return inTransaction2(func(sess *session) error {
		q := m.GetEndpointByIdQuery{
			Id:    cmd.Id,
			OrgId: cmd.OrgId,
		}
		err := GetEndpointById(&q)
		if err != nil {
			return err
		}
		lastState := q.Result

		endpoint := &m.Endpoint{
			OrgId:   cmd.OrgId,
			Name:    cmd.Name,
			Created: time.Now(),
			Updated: time.Now(),
		}

		_, err = sess.Id(cmd.Id).Update(endpoint)
		if err != nil {
			return err
		}
		rawSql := "DELETE FROM endpoint_tag WHERE endpoint_id=? and org_id=?"
		if _, err := sess.Exec(rawSql, cmd.Id, cmd.OrgId); err != nil {
			return err
		}
		if len(cmd.Tags) > 0 {
			endpointTags := make([]m.EndpointTag, 0, len(cmd.Tags))
			for _, tag := range cmd.Tags {
				endpointTags = append(endpointTags, m.EndpointTag{
					OrgId:      cmd.OrgId,
					EndpointId: cmd.Id,
					Tag:        tag,
				})
			}
			sess.Table("endpoint_tag")
			if _, err := sess.Insert(&endpointTags); err != nil {
				return err
			}
		}

		cmd.Result = &m.EndpointDTO{
			Id:    cmd.Id,
			OrgId: endpoint.OrgId,
			Name:  endpoint.Name,
			Tags:  cmd.Tags,
		}
		sess.publishAfterCommit(&events.EndpointUpdated{
			EndpointPayload: events.EndpointPayload{
				Id:    cmd.Id,
				OrgId: endpoint.OrgId,
				Name:  endpoint.Name,
				Tags:  cmd.Tags,
			},
			Timestamp: endpoint.Updated,
			LastState: &events.EndpointPayload{
				Id:    lastState.Id,
				OrgId: lastState.OrgId,
				Name:  lastState.Name,
				Tags:  lastState.Tags,
			},
		})
		return nil
	})
}

func DeleteEndpoint(cmd *m.DeleteEndpointCommand) error {
	return inTransaction2(func(sess *session) error {
		monitorQuery := m.GetMonitorsQuery{
			OrgId:      cmd.OrgId,
			EndpointId: []int64{cmd.Id},
		}
		err := GetMonitors(&monitorQuery)
		if err != nil {
			return err
		}
		if len(monitorQuery.Result) > 0 {
			return m.ErrWithMonitorsDelete
		}

		q := m.GetEndpointByIdQuery{
			Id:    cmd.Id,
			OrgId: cmd.OrgId,
		}
		err = GetEndpointById(&q)
		if err != nil {
			return err
		}

		var rawSql = "DELETE FROM endpoint WHERE id=? and org_id=?"
		_, err = sess.Exec(rawSql, cmd.Id, cmd.OrgId)
		if err != nil {
			return err
		}
		rawSql = "DELETE FROM endpoint_tag WHERE endpoint_id=? and org_id=?"
		if _, err := sess.Exec(rawSql, cmd.Id, cmd.OrgId); err != nil {
			return err
		}
		sess.publishAfterCommit(&events.EndpointRemoved{
			Timestamp: time.Now(),
			Id:        cmd.Id,
			OrgId:     cmd.OrgId,
			Name:      q.Result.Name,
		})
		return err
	})
}
