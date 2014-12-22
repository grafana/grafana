package sqlstore

import (
	"github.com/go-xorm/xorm"
	"github.com/torkelo/grafana-pro/pkg/bus"
	m "github.com/torkelo/grafana-pro/pkg/models"
)

func init() {
	bus.AddHandler("sql", SaveDashboard2)
}

func SaveDashboard2(cmd *m.SaveDashboardCommand) error {
	return inTransaction(func(sess *xorm.Session) error {
		dash := cmd.GetDashboardModel()

		var err error
		if dash.Id == 0 {
			_, err = sess.Insert(dash)
		} else {
			_, err = sess.Id(dash.Id).Update(dash)
		}

		cmd.Result = dash

		return err
	})
}

func GetDashboard(slug string, accountId int64) (*m.Dashboard, error) {
	dashboard := m.Dashboard{Slug: slug, AccountId: accountId}
	has, err := x.Get(&dashboard)
	if err != nil {
		return nil, err
	} else if has == false {
		return nil, m.ErrDashboardNotFound
	}

	return &dashboard, nil
}

func SearchQuery(query string, accountId int64) ([]*m.SearchResult, error) {
	sess := x.Limit(100, 0).Where("account_id=?", accountId)
	sess.Table("Dashboard")

	results := make([]*m.SearchResult, 0)
	err := sess.Find(&results)

	return results, err
}

func DeleteDashboard(slug string, accountId int64) error {
	sess := x.NewSession()
	defer sess.Close()

	rawSql := "DELETE FROM Dashboard WHERE account_id=? and slug=?"
	_, err := sess.Exec(rawSql, accountId, slug)

	return err
}
