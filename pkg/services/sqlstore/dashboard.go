package sqlstore

import (
	"bytes"
	"fmt"

	"github.com/go-xorm/xorm"
	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandler("sql", SaveDashboard)
	bus.AddHandler("sql", GetDashboard)
	bus.AddHandler("sql", DeleteDashboard)
	bus.AddHandler("sql", SearchDashboards)
	bus.AddHandler("sql", GetDashboardTags)
}

func SaveDashboard(cmd *m.SaveDashboardCommand) error {
	return inTransaction(func(sess *xorm.Session) error {
		dash := cmd.GetDashboardModel()

		// try get existing dashboard
		existing := m.Dashboard{Slug: dash.Slug, AccountId: dash.AccountId}
		hasExisting, err := sess.Get(&existing)
		if err != nil {
			return err
		}

		if hasExisting && dash.Id != existing.Id {
			return m.ErrDashboardWithSameNameExists
		}

		if dash.Id == 0 {
			_, err = sess.Insert(dash)
		} else {
			_, err = sess.Id(dash.Id).Update(dash)
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
	dashboard := m.Dashboard{Slug: query.Slug, AccountId: query.AccountId}
	has, err := x.Get(&dashboard)
	if err != nil {
		return err
	} else if has == false {
		return m.ErrDashboardNotFound
	}

	dashboard.Data["id"] = dashboard.Id
	query.Result = &dashboard

	return nil
}

type DashboardSearchProjection struct {
	Id    int64
	Title string
	Slug  string
	Term  string
}

func SearchDashboards(query *m.SearchDashboardsQuery) error {
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

	sql.WriteString(` WHERE dashboard.account_id=?`)

	params = append(params, query.AccountId)

	if query.IsStarred {
		sql.WriteString(` AND star.user_id=?`)
		params = append(params, query.UserId)
	}

	if len(query.Title) > 0 {
		sql.WriteString(" AND dashboard.title LIKE ?")
		params = append(params, "%"+query.Title+"%")
	}

	if len(query.Tag) > 0 {
		sql.WriteString(" AND dashboard_tag.term=?")
		params = append(params, query.Tag)
	}

	if query.Limit == 0 || query.Limit > 10000 {
		query.Limit = 300
	}

	sql.WriteString(fmt.Sprintf(" LIMIT %d", query.Limit))

	var res []DashboardSearchProjection
	err := x.Sql(sql.String(), params...).Find(&res)
	if err != nil {
		return err
	}

	query.Result = make([]*m.DashboardSearchHit, 0)
	hits := make(map[int64]*m.DashboardSearchHit)

	for _, item := range res {
		hit, exists := hits[item.Id]
		if !exists {
			hit = &m.DashboardSearchHit{
				Id:    item.Id,
				Title: item.Title,
				Slug:  item.Slug,
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
					WHERE dashboard.account_id=?
					GROUP BY term`

	query.Result = make([]*m.DashboardTagCloudItem, 0)
	sess := x.Sql(sql, query.AccountId)
	err := sess.Find(&query.Result)
	return err
}

func DeleteDashboard(cmd *m.DeleteDashboardCommand) error {
	sess := x.NewSession()
	defer sess.Close()

	rawSql := "DELETE FROM Dashboard WHERE account_id=? and slug=?"
	_, err := sess.Exec(rawSql, cmd.AccountId, cmd.Slug)

	return err
}
