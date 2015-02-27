package sqlstore

import (
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/events"
	m "github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandler("sql", GetSites)
	bus.AddHandler("sql", GetSiteById)
	bus.AddHandler("sql", AddSite)
	bus.AddHandler("sql", UpdateSite)
	bus.AddHandler("sql", DeleteSite)
}

func GetSiteById(query *m.GetSiteByIdQuery) error {
	var result m.Site
	sess := x.Limit(100, 0).Where("org_id=? AND id=?", query.OrgId, query.Id)
	has, err := sess.Get(&result)

	if !has {
		return m.ErrSiteNotFound
	}
	if err != nil {
		return err
	}
	query.Result = &m.SiteDTO{
		Id:        result.Id,
		OrgId:     result.OrgId,
		Name:      result.Name,
		Slug:      result.Slug,
	}
	return nil
}

func GetSites(query *m.GetSitesQuery) error {
	sess := x.Limit(100, 0).Where("org_id=?", query.OrgId).Asc("name")

	result := make([]*m.Site, 0)
	err := sess.Find(&result)
	if err != nil {
		return err
	}
	query.Result = make([]*m.SiteDTO, 0)
	for _, row := range result {
		query.Result = append(query.Result, &m.SiteDTO{
			Id:        row.Id,
			OrgId:     row.OrgId,
			Name:      row.Name,
			Slug:      row.Slug,
		})
	}
	return nil
}

func AddSite(cmd *m.AddSiteCommand) error {
	return inTransaction2(func(sess *session) error {
		site := &m.Site{
			OrgId:     cmd.OrgId,
			Name:      cmd.Name,
			Created:   time.Now(),
			Updated:   time.Now(),
		}
		site.UpdateSiteSlug()

		if _, err := sess.Insert(site); err != nil {
			return err
		}

		cmd.Result = &m.SiteDTO{
			Id:        site.Id,
			OrgId:     site.OrgId,
			Slug:      site.Slug,
			Name:      site.Name,
		}
		sess.publishAfterCommit(&events.SiteCreated{
			SitePayload: events.SitePayload{
				Id:        site.Id,
				OrgId:     site.OrgId,
				Name:      site.Name,
				Slug:      site.Slug,
			},
			Timestamp: site.Updated,
		})
		return nil
	})
}

func UpdateSite(cmd *m.UpdateSiteCommand) error {
	return inTransaction2(func(sess *session) error {
		q := m.GetSiteByIdQuery{
			Id:        cmd.Id,
			OrgId:     cmd.OrgId,
		}
		err := GetSiteById(&q)
		if err != nil {
			return err
		}
		lastState := q.Result

		site := &m.Site{
			OrgId:     cmd.OrgId,
			Name:      cmd.Name,
			Created:   time.Now(),
			Updated:   time.Now(),
		}
		site.UpdateSiteSlug()

		_, err = sess.Id(cmd.Id).Update(site)
		if err != nil {
			return err
		}

		cmd.Result = &m.SiteDTO{
			Id:        cmd.Id,
			OrgId:     site.OrgId,
			Slug:      site.Slug,
			Name:      site.Name,
		}
		sess.publishAfterCommit(&events.SiteUpdated{
			SitePayload: events.SitePayload{
				Id:        cmd.Id,
				OrgId:     site.OrgId,
				Name:      site.Name,
				Slug:      site.Slug,
			},
			Timestamp: site.Updated,
			LastState: &events.SitePayload{
				Id:        lastState.Id,
				OrgId:     lastState.OrgId,
				Name:      lastState.Name,
				Slug:      lastState.Slug,
			},
		})
		return nil
	})
}

func DeleteSite(cmd *m.DeleteSiteCommand) error {
	return inTransaction2(func(sess *session) error {
		q := m.GetSiteByIdQuery{
			Id:        cmd.Id,
			OrgId:     cmd.OrgId,
		}
		err := GetSiteById(&q)
		if err != nil {
			return err
		}

		var rawSql = "DELETE FROM site WHERE id=? and org_id=?"
		_, err = sess.Exec(rawSql, cmd.Id, cmd.OrgId)
		if err != nil {
			return err
		}
		sess.publishAfterCommit(&events.SiteRemoved{
			Timestamp: time.Now(),
			Id:        cmd.Id,
			OrgId:     cmd.OrgId,
			Name:      q.Result.Name,
		})
		return err
	})
}
