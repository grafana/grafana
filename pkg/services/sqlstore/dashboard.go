package sqlstore

import (
	"bytes"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/metrics"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/search"
)

func init() {
	bus.AddHandler("sql", SaveDashboard)
	bus.AddHandler("sql", GetDashboard)
	bus.AddHandler("sql", GetDashboards)
	bus.AddHandler("sql", DeleteDashboard)
	bus.AddHandler("sql", SearchDashboards)
	bus.AddHandler("sql", GetDashboardTags)
	bus.AddHandler("sql", GetDashboardSlugById)
	bus.AddHandler("sql", GetDashboardsByPluginId)
}

func SaveDashboard(cmd *m.SaveDashboardCommand) error {
	return inTransaction(func(sess *DBSession) error {
		dash := cmd.GetDashboardModel()

		// try get existing dashboard
		var existing, sameTitle m.Dashboard

		if dash.Id > 0 {
			dashWithIdExists, err := sess.Where("id=? AND org_id=?", dash.Id, dash.OrgId).Get(&existing)
			if err != nil {
				return err
			}
			if !dashWithIdExists {
				return m.ErrDashboardNotFound
			}

			// check for is someone else has written in between
			if dash.Version != existing.Version {
				if cmd.Overwrite {
					dash.Version = existing.Version
				} else {
					return m.ErrDashboardVersionMismatch
				}
			}

			// do not allow plugin dashboard updates without overwrite flag
			if existing.PluginId != "" && cmd.Overwrite == false {
				return m.UpdatePluginDashboardError{PluginId: existing.PluginId}
			}
		}

		sameTitleExists, err := sess.Where("org_id=? AND slug=?", dash.OrgId, dash.Slug).Get(&sameTitle)
		if err != nil {
			return err
		}

		if sameTitleExists {
			// another dashboard with same name
			if dash.Id != sameTitle.Id {
				if cmd.Overwrite {
					dash.Id = sameTitle.Id
					dash.Version = sameTitle.Version
				} else {
					return m.ErrDashboardWithSameNameExists
				}
			}
		}

		parentVersion := dash.Version
		affectedRows := int64(0)

		if dash.Id == 0 {
			dash.Version = 1
			metrics.M_Api_Dashboard_Insert.Inc()
			dash.Data.Set("version", dash.Version)
			affectedRows, err = sess.Insert(dash)
		} else {
			dash.Version += 1
			dash.Data.Set("version", dash.Version)
			affectedRows, err = sess.Id(dash.Id).Update(dash)
		}

		if err != nil {
			return err
		}

		if affectedRows == 0 {
			return m.ErrDashboardNotFound
		}

		dashVersion := &m.DashboardVersion{
			DashboardId:   dash.Id,
			ParentVersion: parentVersion,
			RestoredFrom:  cmd.RestoredFrom,
			Version:       dash.Version,
			Created:       time.Now(),
			CreatedBy:     dash.UpdatedBy,
			Message:       cmd.Message,
			Data:          dash.Data,
		}

		// insert version entry
		if affectedRows, err = sess.Insert(dashVersion); err != nil {
			return err
		} else if affectedRows == 0 {
			return m.ErrDashboardNotFound
		}

		// delete existing tabs
		_, err = sess.Exec("DELETE FROM dashboard_tag WHERE dashboard_id=?", dash.Id)
		if err != nil {
			return err
		}

		// insert new tags
		tags := dash.GetTags()
		if len(tags) > 0 {
			for _, tag := range tags {
				if _, err := sess.Insert(&DashboardTag{DashboardId: dash.Id, Term: tag}); err != nil {
					return err
				}
			}
		}

		cmd.Result = dash

		return err
	})
}

func GetDashboard(query *m.GetDashboardQuery) error {
	dashboard := m.Dashboard{Slug: query.Slug, OrgId: query.OrgId, Id: query.Id}
	has, err := x.Get(&dashboard)

	if err != nil {
		return err
	} else if has == false {
		return m.ErrDashboardNotFound
	}

	dashboard.Data.Set("id", dashboard.Id)
	query.Result = &dashboard
	return nil
}

type DashboardSearchProjection struct {
	Id    int64
	Title string
	Slug  string
	Term  string
}

func SearchDashboards(query *search.FindPersistedDashboardsQuery) error {
	var sql bytes.Buffer
	params := make([]interface{}, 0)

	sql.WriteString(`SELECT
					  dashboard.id,
					  dashboard.title,
					  dashboard.slug,
					  dashboard_tag.term
					FROM dashboard
					LEFT OUTER JOIN dashboard_tag on dashboard_tag.dashboard_id = dashboard.id`)

	if query.IsStarred {
		sql.WriteString(" INNER JOIN star on star.dashboard_id = dashboard.id")
	}

	sql.WriteString(` WHERE dashboard.org_id=?`)

	params = append(params, query.OrgId)

	if query.IsStarred {
		sql.WriteString(` AND star.user_id=?`)
		params = append(params, query.UserId)
	}

	if len(query.DashboardIds) > 0 {
		sql.WriteString(" AND (")
		for i, dashboardId := range query.DashboardIds {
			if i != 0 {
				sql.WriteString(" OR")
			}

			sql.WriteString(" dashboard.id = ?")
			params = append(params, dashboardId)
		}
		sql.WriteString(")")
	}

	if len(query.Title) > 0 {
		sql.WriteString(" AND dashboard.title " + dialect.LikeStr() + " ?")
		params = append(params, "%"+query.Title+"%")
	}

	sql.WriteString(fmt.Sprintf(" ORDER BY dashboard.title ASC LIMIT 1000"))

	var res []DashboardSearchProjection

	err := x.Sql(sql.String(), params...).Find(&res)
	if err != nil {
		return err
	}

	query.Result = make([]*search.Hit, 0)
	hits := make(map[int64]*search.Hit)

	for _, item := range res {
		hit, exists := hits[item.Id]
		if !exists {
			hit = &search.Hit{
				Id:    item.Id,
				Title: item.Title,
				Uri:   "db/" + item.Slug,
				Type:  search.DashHitDB,
				Tags:  []string{},
			}
			query.Result = append(query.Result, hit)
			hits[item.Id] = hit
		}
		if len(item.Term) > 0 {
			hit.Tags = append(hit.Tags, item.Term)
		}
	}

	return err
}

func GetDashboardTags(query *m.GetDashboardTagsQuery) error {
	sql := `SELECT
					  COUNT(*) as count,
						term
					FROM dashboard
					INNER JOIN dashboard_tag on dashboard_tag.dashboard_id = dashboard.id
					WHERE dashboard.org_id=?
					GROUP BY term`

	query.Result = make([]*m.DashboardTagCloudItem, 0)
	sess := x.Sql(sql, query.OrgId)
	err := sess.Find(&query.Result)
	return err
}

func DeleteDashboard(cmd *m.DeleteDashboardCommand) error {
	return inTransaction(func(sess *DBSession) error {
		dashboard := m.Dashboard{Slug: cmd.Slug, OrgId: cmd.OrgId}
		has, err := sess.Get(&dashboard)
		if err != nil {
			return err
		} else if has == false {
			return m.ErrDashboardNotFound
		}

		deletes := []string{
			"DELETE FROM dashboard_tag WHERE dashboard_id = ? ",
			"DELETE FROM star WHERE dashboard_id = ? ",
			"DELETE FROM dashboard WHERE id = ?",
			"DELETE FROM playlist_item WHERE type = 'dashboard_by_id' AND value = ?",
			"DELETE FROM dashboard_version WHERE dashboard_id = ?",
		}

		for _, sql := range deletes {
			_, err := sess.Exec(sql, dashboard.Id)
			if err != nil {
				return err
			}
		}

		if err := DeleteAlertDefinition(dashboard.Id, sess); err != nil {
			return nil
		}

		return nil
	})
}

func GetDashboards(query *m.GetDashboardsQuery) error {
	if len(query.DashboardIds) == 0 {
		return m.ErrCommandValidationFailed
	}

	var dashboards = make([]*m.Dashboard, 0)

	err := x.In("id", query.DashboardIds).Find(&dashboards)
	query.Result = dashboards

	if err != nil {
		return err
	}

	return nil
}

func GetDashboardsByPluginId(query *m.GetDashboardsByPluginIdQuery) error {
	var dashboards = make([]*m.Dashboard, 0)

	err := x.Where("org_id=? AND plugin_id=?", query.OrgId, query.PluginId).Find(&dashboards)
	query.Result = dashboards

	if err != nil {
		return err
	}

	return nil
}

type DashboardSlugDTO struct {
	Slug string
}

func GetDashboardSlugById(query *m.GetDashboardSlugByIdQuery) error {
	var rawSql = `SELECT slug from dashboard WHERE Id=?`
	var slug = DashboardSlugDTO{}

	exists, err := x.Sql(rawSql, query.Id).Get(&slug)

	if err != nil {
		return err
	} else if exists == false {
		return m.ErrDashboardNotFound
	}

	query.Result = slug.Slug
	return nil
}
