package sqlstore

import "github.com/torkelo/grafana-pro/pkg/models"

func SaveDashboard(dash *models.Dashboard) error {
	var err error

	sess := x.NewSession()
	defer sess.Close()

	if err = sess.Begin(); err != nil {
		return err
	}

	if dash.Id == 0 {
		_, err = sess.Insert(dash)
	} else {
		_, err = sess.Id(dash.Id).Update(dash)
	}

	if err != nil {
		sess.Rollback()
		return err
	} else if err = sess.Commit(); err != nil {
		return err
	}

	return nil
}

func GetDashboard(slug string, accountId int64) (*models.Dashboard, error) {

	dashboard := models.Dashboard{Slug: slug, AccountId: accountId}
	has, err := x.Get(&dashboard)
	if err != nil {
		return nil, err
	} else if has == false {
		return nil, models.ErrDashboardNotFound
	}

	return &dashboard, nil
}

func SearchQuery(query string, accountId int64) ([]*models.SearchResult, error) {
	sess := x.Limit(100, 0).Where("account_id=?", accountId)
	sess.Table("Dashboard")

	results := make([]*models.SearchResult, 0)
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
