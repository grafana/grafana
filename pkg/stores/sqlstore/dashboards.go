package sqlstore

import (
	"github.com/go-xorm/xorm"
	"github.com/torkelo/grafana-pro/pkg/bus"
	m "github.com/torkelo/grafana-pro/pkg/models"
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

	query.Result = &dashboard

	return nil
}

func SearchDashboards(query *m.SearchDashboardsQuery) error {
	titleQuery := "%" + query.Query + "%"

	sess := x.Limit(100, 0).Where("account_id=? AND title LIKE ?", query.AccountId, titleQuery)
	sess.Table("Dashboard")

	query.Result = make([]m.DashboardSearchHit, 0)
	err := sess.Find(&query.Result)

	return err
}

func GetDashboardTags(query *m.GetDashboardTagsQuery) error {
	query.Result = []m.DashboardTagCloudItem{
		m.DashboardTagCloudItem{Term: "test", Count: 10},
		m.DashboardTagCloudItem{Term: "prod", Count: 20},
	}
	return nil
}

func DeleteDashboard(cmd *m.DeleteDashboardCommand) error {
	sess := x.NewSession()
	defer sess.Close()

	rawSql := "DELETE FROM Dashboard WHERE account_id=? and slug=?"
	_, err := sess.Exec(rawSql, cmd.AccountId, cmd.Slug)

	return err
}
