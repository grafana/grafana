package sqlstore

import (
	"fmt"
	"strings"
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
	bus.AddHandler("sql", GetAllEndpointTags)
}

type EndpointWithTag struct {
	Id      int64
	OrgId   int64
	Name    string
	Slug    string
	Tags    string
	Created time.Time
	Updated time.Time
}

func GetEndpointById(query *m.GetEndpointByIdQuery) error {
	sess := session{Session: x.Table("endpoint")}
	return GetEndpointByIdTransaction(query, &sess)
}

func GetEndpointByIdTransaction(query *m.GetEndpointByIdQuery, sess *session) error {
	rawParams := make([]interface{}, 0)
	rawSql := `SELECT
		GROUP_CONCAT(DISTINCT(endpoint_tag.tag)) as tags,
		endpoint.*
	FROM endpoint
	LEFT JOIN endpoint_tag ON endpoint.id = endpoint_tag.endpoint_id
	WHERE endpoint.org_id=? AND endpoint.id=?
	GROUP BY endpoint.id
	`
	rawParams = append(rawParams, query.OrgId, query.Id)

	results := make([]*EndpointWithTag, 0)
	err := sess.Sql(rawSql, rawParams...).Find(&results)
	if err != nil {
		return err
	}
	if len(results) < 1 {
		return m.ErrEndpointNotFound
	}
	result := results[0]

	tags := make([]string, 0)
	if result.Tags != "" {
		tags = strings.Split(result.Tags, ",")
	}
	query.Result = &m.EndpointDTO{
		Id:    result.Id,
		OrgId: result.OrgId,
		Name:  result.Name,
		Slug:  result.Slug,
		Tags:  tags,
	}
	return nil
}

func GetEndpoints(query *m.GetEndpointsQuery) error {
	sess := x.Table("endpoint")
	rawParams := make([]interface{}, 0)
	rawSql := `SELECT
		GROUP_CONCAT(DISTINCT(endpoint_tag.tag)) as tags,
		endpoint.*
	FROM endpoint
	LEFT JOIN endpoint_tag ON endpoint.id = endpoint_tag.endpoint_id
	`

	whereSql := make([]string, 0)
	whereSql = append(whereSql, "endpoint.org_id=?")
	rawParams = append(rawParams, query.OrgId)

	if len(query.Tag) > 0 {
		// this is a bit complicated because we want to
		// match only endpoints that have one of the specified tags
		// but we still need to return all of the tags that
		// the endpoint has.
		rawSql += "LEFT JOIN endpoint_tag AS et ON et.endpoint_id = endpoint.id\n"
		p := make([]string, len(query.Tag))
		for i, t := range query.Tag {
			p[i] = "?"
			rawParams = append(rawParams, t)
		}
		whereSql = append(whereSql, fmt.Sprintf("et.tag IN (%s)", strings.Join(p, ",")))
	}

	rawSql += "WHERE " + strings.Join(whereSql, " AND ")
	rawSql += " GROUP BY endpoint.id"

	result := make([]*EndpointWithTag, 0)
	err := sess.Sql(rawSql, rawParams...).Find(&result)
	if err != nil {
		return err
	}

	endpoints := make([]*m.EndpointDTO, 0)
	//iterate through all of the results and build out our model.
	for _, row := range result {
		tags := make([]string, 0)
		if row.Tags != "" {
			tags = strings.Split(row.Tags, ",")
		}
		endpoints = append(endpoints, &m.EndpointDTO{
			Id:    row.Id,
			OrgId: row.OrgId,
			Name:  row.Name,
			Slug:  row.Slug,
			Tags:  tags,
		})
	}

	query.Result = endpoints

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
		endpoint.UpdateEndpointSlug()

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
			Slug:  endpoint.Slug,
			Tags:  cmd.Tags,
		}
		sess.publishAfterCommit(&events.EndpointCreated{
			EndpointPayload: events.EndpointPayload{
				Id:    endpoint.Id,
				OrgId: endpoint.OrgId,
				Name:  endpoint.Name,
				Slug:  endpoint.Slug,
				Tags:  cmd.Tags,
			},
			Timestamp: endpoint.Updated,
		})

		// add any included momitors.
		if len(cmd.Monitors) > 0 {
			for _, monitorCmd := range cmd.Monitors {
				monitorCmd.OrgId = cmd.OrgId
				monitorCmd.EndpointId = endpoint.Id
				if err := addMonitorTransaction(monitorCmd, sess); err != nil {
					fmt.Println(err)
					return err
				}
			}
		}

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
		endpoint.UpdateEndpointSlug()

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
			Slug:  endpoint.Slug,
			Tags:  cmd.Tags,
		}
		sess.publishAfterCommit(&events.EndpointUpdated{
			EndpointPayload: events.EndpointPayload{
				Id:    cmd.Id,
				OrgId: endpoint.OrgId,
				Name:  endpoint.Name,
				Slug:  endpoint.Slug,
				Tags:  cmd.Tags,
			},
			Timestamp: endpoint.Updated,
			LastState: &events.EndpointPayload{
				Id:    lastState.Id,
				OrgId: lastState.OrgId,
				Name:  lastState.Name,
				Slug:  lastState.Slug,
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
			for _, mon := range monitorQuery.Result {
				monitorDelCmd := &m.DeleteMonitorCommand{Id: mon.Id, OrgId: cmd.OrgId}
				if err := DeleteMonitorTransaction(monitorDelCmd, sess); err != nil {
					return err
				}
			}
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
			Slug:      q.Result.Slug,
		})
		return err
	})
}

func GetAllEndpointTags(query *m.GetAllEndpointTagsQuery) error {
	rawSql := `SELECT tag FROM endpoint_tag WHERE org_id=? GROUP BY tag`

	sess := x.Sql(rawSql, query.OrgId)
	tags := make([]tagNameWrapper, 0)

	if err := sess.Find(&tags); err != nil {
		return err
	}

	query.Result = make([]string, 0)
	for _, tag := range tags {
		query.Result = append(query.Result, tag.Tag)
	}

	return nil
}
