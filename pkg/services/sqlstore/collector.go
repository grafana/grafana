package sqlstore

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/go-xorm/xorm"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/events"
	m "github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandler("sql", GetCollectors)
	bus.AddHandler("sql", GetCollectorById)
	bus.AddHandler("sql", GetCollectorByName)
	bus.AddHandler("sql", AddCollector)
	bus.AddHandler("sql", UpdateCollector)
	bus.AddHandler("sql", DeleteCollector)
	bus.AddHandler("sql", AddCollectorSession)
	bus.AddHandler("sql", DeleteCollectorSession)
	bus.AddHandler("sql", ClearCollectorSession)
	bus.AddHandler("sql", GetCollectorSessions)
	bus.AddHandler("sql", GetCollectorTags)
}

type CollectorWithTag struct {
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
	Online    bool
	Enabled   bool
}

func GetCollectorById(query *m.GetCollectorByIdQuery) error {
	sess := x.Table("collector")
	rawParams := make([]interface{}, 0)
	rawSql := `SELECT
		GROUP_CONCAT(DISTINCT(collector_tag.tag)) as tags,
		collector.*
	FROM collector
	LEFT JOIN collector_tag ON collector.id = collector_tag.collector_id AND collector_tag.org_id=?
	WHERE
		(collector.public=1 OR collector.org_id=?)
	AND
		collector.id=?
	GROUP BY collector.id
	`
	rawParams = append(rawParams, query.OrgId, query.OrgId, query.Id)
	results := make([]CollectorWithTag, 0)
	err := sess.Sql(rawSql, rawParams...).Find(&results)
	if err != nil {
		return err
	}
	if len(results) < 1 {
		return m.ErrCollectorNotFound
	}

	result := results[0]

	tags := make([]string, 0)
	if result.Tags != "" {
		tags = strings.Split(result.Tags, ",")
	}

	query.Result = &m.CollectorDTO{
		Id:        result.Id,
		OrgId:     result.OrgId,
		Name:      result.Name,
		Slug:      result.Slug,
		Tags:      tags,
		Latitude:  result.Latitude,
		Longitude: result.Longitude,
		Public:    result.Public,
		Online:    result.Online,
		Enabled:   result.Enabled,
	}

	return err
}

func GetCollectorByName(query *m.GetCollectorByNameQuery) error {
	sess := x.Table("collector")
	rawParams := make([]interface{}, 0)
	rawSql := `SELECT
		GROUP_CONCAT(DISTINCT(collector_tag.tag)) as tags,
		collector.*
	FROM collector
	LEFT JOIN collector_tag ON collector.id = collector_tag.collector_id AND collector_tag.org_id=?
	WHERE
		(collector.public=1 OR collector.org_id=?)
	AND
		collector.name=?
	GROUP BY collector.id
	`
	rawParams = append(rawParams, query.OrgId, query.OrgId, query.Name)
	results := make([]CollectorWithTag, 0)
	err := sess.Sql(rawSql, rawParams...).Find(&results)
	if err != nil {
		return err
	}
	if len(results) < 1 {
		return m.ErrCollectorNotFound
	}

	result := results[0]

	tags := make([]string, 0)
	if result.Tags != "" {
		tags = strings.Split(result.Tags, ",")
	}

	query.Result = &m.CollectorDTO{
		Id:        result.Id,
		OrgId:     result.OrgId,
		Name:      result.Name,
		Slug:      result.Slug,
		Tags:      tags,
		Latitude:  result.Latitude,
		Longitude: result.Longitude,
		Public:    result.Public,
		Online:    result.Online,
		Enabled:   result.Enabled,
	}

	return err
}

func GetCollectors(query *m.GetCollectorsQuery) error {
	sess := x.Table("collector")
	rawParams := make([]interface{}, 0)
	rawSql := `SELECT
		GROUP_CONCAT(DISTINCT(collector_tag.tag)) as tags,
		collector.*
	FROM collector
	LEFT JOIN collector_tag ON collector.id = collector_tag.collector_id AND collector_tag.org_id=?
	`
	rawParams = append(rawParams, query.OrgId)
	whereSql := make([]string, 0)
	whereSql = append(whereSql, "(collector.public=1 OR collector.org_id=?)")
	rawParams = append(rawParams, query.OrgId)
	if len(query.Tag) > 0 {
		// this is a bit complicated because we want to
		// match only collectors that have the tag(s),
		// but we still need to return all of the tags that
		// the collector has.
		rawSql += `LEFT JOIN collector_tag AS lt
		           ON lt.collector_id = collector.id AND collector_tag.org_id=?
		           `
		rawParams = append(rawParams, query.OrgId)
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
		whereSql = append(whereSql, fmt.Sprintf("collector.name IN (%s)", strings.Join(p, ",")))
	}
	if query.Public != "" {
		if p, err := strconv.ParseBool(query.Public); err == nil {
			whereSql = append(whereSql, "collector.public=?")
			rawParams = append(rawParams, p)
		} else {
			return err
		}
	}

	rawSql += "WHERE " + strings.Join(whereSql, " AND ")
	rawSql += " GROUP BY collector.id"

	result := make([]CollectorWithTag, 0)
	err := sess.Sql(rawSql, rawParams...).Find(&result)
	if err != nil {
		return err
	}

	collectors := make([]*m.CollectorDTO, len(result))

	//iterate through all of the results and build out our collectors model.
	for i, row := range result {
		tags := make([]string, 0)
		if row.Tags != "" {
			tags = strings.Split(row.Tags, ",")
		}
		collectors[i] = &m.CollectorDTO{
			Id:        row.Id,
			OrgId:     row.OrgId,
			Name:      row.Name,
			Slug:      row.Slug,
			Latitude:  row.Latitude,
			Longitude: row.Longitude,
			Tags:      tags,
			Public:    row.Public,
			Online:    row.Online,
			Enabled:   row.Enabled,
		}
	}

	query.Result = collectors
	return nil
}

func DeleteCollector(cmd *m.DeleteCollectorCommand) error {
	return inTransaction(func(sess *xorm.Session) error {
		//Query the collector to make sure we own it.
		collectorQuery := m.GetCollectorByIdQuery{
			Id:    cmd.Id,
			OrgId: cmd.OrgId,
		}
		err := GetCollectorById(&collectorQuery)
		if err != nil {
			return err
		}
		if collectorQuery.OrgId != cmd.OrgId {
			return errors.New("Permision Denined. You do not own this Collector.")
		}

		var rawSql = "DELETE FROM collector_tag WHERE collector_id=?"
		if _, err := sess.Exec(rawSql, cmd.Id); err != nil {
			return err
		}
		rawSql = "DELETE FROM collector WHERE id=?"
		if _, err := sess.Exec(rawSql, cmd.Id); err != nil {
			return err
		}
		return nil
	})
}

func AddCollector(cmd *m.AddCollectorCommand) error {

	return inTransaction(func(sess *xorm.Session) error {
		l := &m.Collector{
			OrgId:     cmd.OrgId,
			Name:      cmd.Name,
			Public:    cmd.Public,
			Latitude:  cmd.Latitude,
			Longitude: cmd.Longitude,
			Created:   time.Now(),
			Updated:   time.Now(),
			Online:    cmd.Online,
			Enabled:   cmd.Enabled,
		}
		l.UpdateCollectorSlug()
		sess.UseBool("public")
		sess.UseBool("online")
		sess.UseBool("enabled")
		if _, err := sess.Insert(l); err != nil {
			return err
		}
		collectorTags := make([]m.CollectorTag, 0, len(cmd.Tags))
		for _, tag := range cmd.Tags {
			collectorTags = append(collectorTags, m.CollectorTag{
				OrgId:       cmd.OrgId,
				CollectorId: l.Id,
				Tag:         tag,
			})
		}
		if len(collectorTags) > 0 {
			sess.Table("collector_tag")
			if _, err := sess.Insert(&collectorTags); err != nil {
				return err
			}
		}

		cmd.Result = &m.CollectorDTO{
			Id:        l.Id,
			OrgId:     l.OrgId,
			Name:      l.Name,
			Slug:      l.Slug,
			Tags:      cmd.Tags,
			Latitude:  l.Latitude,
			Longitude: l.Longitude,
			Public:    l.Public,
			Online:    l.Online,
			Enabled:   l.Enabled,
		}
		return nil
	})
}

func CopyPublicCollectorTags(orgId int64, sess *session) error {
	sess.Table("collector_tag")
	sess.Join("INNER", "collector", "collector.id=collector_tag.collector_id")
	sess.Where("collector.public=1").And("collector.org_id=collector_tag.org_id")
	result := make([]*m.CollectorTag, 0)
	err := sess.Find(&result)
	if err != nil {
		return err
	}

	if len(result) > 0 {
		collectorTags := make([]m.CollectorTag, len(result))
		for i, collectorTag := range result {
			collectorTags[i] = m.CollectorTag{
				OrgId:       orgId,
				CollectorId: collectorTag.CollectorId,
				Tag:         collectorTag.Tag,
			}
		}
		sess.Table("collector_tag")
		if _, err := sess.Insert(&collectorTags); err != nil {
			return err
		}
	}
	return nil

}

func UpdateCollector(cmd *m.UpdateCollectorCommand) error {

	return inTransaction(func(sess *xorm.Session) error {
		//Query the collector to make sure we own it.
		collectorQuery := m.GetCollectorByIdQuery{
			Id:    cmd.Id,
			OrgId: cmd.OrgId,
		}
		err := GetCollectorById(&collectorQuery)
		if err != nil {
			return err
		}

		//the collector can only be edited by those who own it.
		if collectorQuery.Result.OrgId == cmd.OrgId {
			l := &m.Collector{
				OrgId:     cmd.OrgId,
				Name:      cmd.Name,
				Latitude:  cmd.Latitude,
				Longitude: cmd.Longitude,
				Public:    cmd.Public,
				Enabled:   cmd.Enabled,
				Updated:   time.Now(),
			}
			l.UpdateCollectorSlug()
			sess.UseBool("enabled")
			sess.UseBool("public")
			_, err := sess.Id(cmd.Id).Update(l)
			if err != nil {
				return err
			}
			//if we are un-publicing a collector, then we need to remove
			//the tags created by all users on the collector.
			if collectorQuery.Result.Public && !cmd.Public {
				rawSql := "DELETE from collector_tag where collector_id=? AND org_id != ?"
				if _, err := sess.Exec(rawSql, cmd.Id, cmd.OrgId); err != nil {
					return err
				}
			}
		}

		tagMap := make(map[string]bool)
		tagsToDelete := make([]string, 0)
		tagsToAddMap := make(map[string]bool, 0)
		// create map of current tags
		for _, t := range collectorQuery.Result.Tags {
			tagMap[t] = false
		}

		// create map of tags to add. We use a map
		// to ensure that we only add each tag once.
		for _, t := range cmd.Tags {
			if _, ok := tagMap[t]; !ok {
				tagsToAddMap[t] = true
			}
			// mark that this tag has been seen.
			tagMap[t] = true
		}

		//create list of tags to delete
		for t, seen := range tagMap {
			if !seen {
				tagsToDelete = append(tagsToDelete, t)
			}
		}

		// create list of tags to add.
		tagsToAdd := make([]string, len(tagsToAddMap))
		i := 0
		for t := range tagsToAddMap {
			tagsToAdd[i] = t
			i += 1
		}

		if len(tagsToDelete) > 0 {
			rawParams := make([]interface{}, 0)
			rawParams = append(rawParams, cmd.Id, cmd.OrgId)
			p := make([]string, len(tagsToDelete))
			for i, t := range tagsToDelete {
				p[i] = "?"
				rawParams = append(rawParams, t)
			}
			rawSql := fmt.Sprintf("DELETE FROM collector_tag WHERE collector_id=? AND org_id=? AND tag IN (%s)", strings.Join(p, ","))
			if _, err := sess.Exec(rawSql, rawParams...); err != nil {
				return err
			}
		}

		if len(tagsToAdd) > 0 {
			newCollectorTags := make([]m.CollectorTag, len(tagsToAdd))
			for i, tag := range tagsToAdd {
				newCollectorTags[i] = m.CollectorTag{
					OrgId:       cmd.OrgId,
					CollectorId: cmd.Id,
					Tag:         tag,
				}
			}
			sess.Table("collector_tag")
			if _, err := sess.Insert(&newCollectorTags); err != nil {
				return err
			}

			if cmd.Public && collectorQuery.Result.OrgId == cmd.OrgId {
				// if the tag was added by the owner of a public collector,
				// then the tag should be copied to all organisations.
				rawSql := `INSERT INTO collector_tag (org_id, collector_id, tag)
							SELECT org.id as org_id, ? as collector_id, ? as tag
							FROM org LEFT JOIN collector_tag
							ON collector_tag.org_id = org.id AND collector_tag.tag = ? and collector_tag.collector_id=?
							WHERE collector_tag.id IS NULL and org.id != ?`
				for _, tag := range tagsToAdd {
					if _, err := sess.Exec(rawSql, cmd.Id, tag, tag, cmd.Id, cmd.OrgId); err != nil {
						return err
					}
				}
			}
		}

		return nil
	})
}

func AddCollectorSession(cmd *m.AddCollectorSessionCommand) error {
	return inTransaction2(func(sess *session) error {
		collectorSess := m.CollectorSession{
			OrgId:       cmd.OrgId,
			CollectorId: cmd.CollectorId,
			SocketId:    cmd.SocketId,
			InstanceId:  cmd.InstanceId,
			Updated:     time.Now(),
		}
		if _, err := sess.Insert(&collectorSess); err != nil {
			return err
		}
		rawSql := "UPDATE collector set online=1 where id=?"
		if _, err := sess.Exec(rawSql, cmd.CollectorId); err != nil {
			return err
		}
		sess.publishAfterCommit(&events.CollectorConnected{
			CollectorId: cmd.CollectorId,
			InstanceId:  cmd.InstanceId,
		})
		return nil
	})
}

func GetCollectorSessions(query *m.GetCollectorSessionsQuery) error {
	sess := session{Session: x.Table("collector_session")}
	return GetCollectorSessionsTransaction(query, &sess)
}

func GetCollectorSessionsTransaction(query *m.GetCollectorSessionsQuery, sess *session) error {
	fmt.Printf("searching for sessions for collector %d\n", query.CollectorId)
	if query.CollectorId != 0 {
		sess.And("collector_id=?", query.CollectorId)
	}
	if query.InstanceId != "" {
		sess.And("instance_id=?", query.InstanceId)
	}
	err := sess.OrderBy("updated").Find(&query.Result)
	return err

}

func DeleteCollectorSession(cmd *m.DeleteCollectorSessionCommand) error {
	return inTransaction2(func(sess *session) error {
		var rawSql = "DELETE FROM collector_session WHERE org_id=? AND socket_id=?"
		result, err := sess.Exec(rawSql, cmd.OrgId, cmd.SocketId)
		if err != nil {
			return err
		}
		rowsAffected, err := result.RowsAffected()
		if rowsAffected == 0 {
			//nothing was deleted. so no need to cleanup anything
			return nil
		}
		q := m.GetCollectorSessionsQuery{CollectorId: cmd.CollectorId}
		if err := GetCollectorSessionsTransaction(&q, sess); err != nil {
			return err
		}
		if len(q.Result) < 1 {
			rawSql := "UPDATE collector set online=0 where id=?"
			if _, err := sess.Exec(rawSql, cmd.CollectorId); err != nil {
				return err
			}
		}
		sess.publishAfterCommit(&events.CollectorDisconnected{
			CollectorId: cmd.CollectorId,
			InstanceId:  "",
		})
		return nil
	})
}

type collectorOnlineSession struct {
	CollectorId int64
	Online      bool
	SessionId   int64
}

func ClearCollectorSession(cmd *m.ClearCollectorSessionCommand) error {
	return inTransaction2(func(sess *session) error {
		q := m.GetCollectorSessionsQuery{
			InstanceId: cmd.InstanceId,
		}
		sess.Table("collector_session")
		if err := GetCollectorSessionsTransaction(&q, sess); err != nil {
			return err
		}
		var rawSql = "DELETE FROM collector_session where instance_id=?"
		if _, err := sess.Exec(rawSql, cmd.InstanceId); err != nil {
			return err
		}

		rawSql = `select collector.id as collector_id, online, collector_session.id as session_id
		      from collector LEFT join collector_session
		      on collector_session.collector_id = collector.id group by collector.id`
		result := make([]*collectorOnlineSession, 0)
		if err := sess.Sql(rawSql).Find(&result); err != nil {
			return err
		}
		toOnline := make([]int64, 0)
		toOffline := make([]int64, 0)
		for _, r := range result {
			if r.Online && r.SessionId == 0 {
				toOffline = append(toOffline, r.CollectorId)
			} else if !r.Online && r.SessionId > 0 {
				toOnline = append(toOnline, r.CollectorId)
			}
		}
		if len(toOnline) > 0 {
			a := make([]string, len(toOnline))
			args := make([]interface{}, len(toOnline))
			for i, id := range toOnline {
				args[i] = id
				a[i] = "?"
			}
			rawSql = fmt.Sprintf("UPDATE collector set online=1 where id in (%s)", strings.Join(a, ","))

			if _, err := sess.Exec(rawSql, args...); err != nil {
				fmt.Println("failed to set collectors to online: ", rawSql)
				return err
			}
		}
		if len(toOffline) > 0 {
			a := make([]string, len(toOffline))
			args := make([]interface{}, len(toOffline))
			for i, id := range toOffline {
				args[i] = id
				a[i] = "?"
			}
			rawSql = fmt.Sprintf("UPDATE collector set online=0 where id in (%s)", strings.Join(a, ","))

			if _, err := sess.Exec(rawSql, args...); err != nil {
				fmt.Println("failed to set collectors to offline:", rawSql)
				return err
			}
		}
		//send collectorDisconnected event for each collector-session deleted.
		for _, session := range q.Result {
			sess.publishAfterCommit(&events.CollectorDisconnected{
				CollectorId: session.CollectorId,
				InstanceId:  session.InstanceId,
			})
		}
		return nil
	})
}

type tagNameWrapper struct {
	Tag string
}

func GetCollectorTags(query *m.GetAllCollectorTagsQuery) error {
	rawSql := `SELECT tag FROM collector_tag WHERE org_id=? GROUP BY tag`

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
