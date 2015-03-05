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

func GetEndpointById(query *m.GetEndpointByIdQuery) error {
	var result m.Endpoint
	sess := x.Limit(100, 0).Where("org_id=? AND id=?", query.OrgId, query.Id)
	has, err := sess.Get(&result)

	if !has {
		return m.ErrEndpointNotFound
	}
	if err != nil {
		return err
	}
	query.Result = &m.EndpointDTO{
		Id:    result.Id,
		OrgId: result.OrgId,
		Name:  result.Name,
	}
	return nil
}

func GetEndpoints(query *m.GetEndpointsQuery) error {
	sess := x.Limit(100, 0).Where("org_id=?", query.OrgId).Asc("name")

	result := make([]*m.Endpoint, 0)
	err := sess.Find(&result)
	if err != nil {
		return err
	}
	query.Result = make([]*m.EndpointDTO, 0)
	for _, row := range result {
		query.Result = append(query.Result, &m.EndpointDTO{
			Id:    row.Id,
			OrgId: row.OrgId,
			Name:  row.Name,
		})
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

		cmd.Result = &m.EndpointDTO{
			Id:    endpoint.Id,
			OrgId: endpoint.OrgId,
			Name:  endpoint.Name,
		}
		sess.publishAfterCommit(&events.EndpointCreated{
			EndpointPayload: events.EndpointPayload{
				Id:    endpoint.Id,
				OrgId: endpoint.OrgId,
				Name:  endpoint.Name,
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

		cmd.Result = &m.EndpointDTO{
			Id:    cmd.Id,
			OrgId: endpoint.OrgId,
			Name:  endpoint.Name,
		}
		sess.publishAfterCommit(&events.EndpointUpdated{
			EndpointPayload: events.EndpointPayload{
				Id:    cmd.Id,
				OrgId: endpoint.OrgId,
				Name:  endpoint.Name,
			},
			Timestamp: endpoint.Updated,
			LastState: &events.EndpointPayload{
				Id:    lastState.Id,
				OrgId: lastState.OrgId,
				Name:  lastState.Name,
			},
		})
		return nil
	})
}

func DeleteEndpoint(cmd *m.DeleteEndpointCommand) error {
	return inTransaction2(func(sess *session) error {
		monitorQuery := m.GetMonitorsQuery{
			OrgId: cmd.OrgId,
			EndpointId: []int64{cmd.Id},
		}
		err := GetMonitors(&monitorQuery)
		if err != nil {
			return err
		}
		if len(monitorQuery.Result) < 1 {
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
		sess.publishAfterCommit(&events.EndpointRemoved{
			Timestamp: time.Now(),
			Id:        cmd.Id,
			OrgId:     cmd.OrgId,
			Name:      q.Result.Name,
		})
		return err
	})
}
