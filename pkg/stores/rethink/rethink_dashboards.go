package rethink

import (
	"errors"

	r "github.com/dancannon/gorethink"

	"github.com/torkelo/grafana-pro/pkg/log"
	"github.com/torkelo/grafana-pro/pkg/models"
)

func SaveDashboard(dash *models.Dashboard) error {
	resp, err := r.Table("dashboards").Insert(dash, r.InsertOpts{Conflict: "update"}).RunWrite(session)
	if err != nil {
		return err
	}

	log.Info("Inserted: %v, Errors: %v, Updated: %v", resp.Inserted, resp.Errors, resp.Updated)
	log.Info("First error:", resp.FirstError)
	if len(resp.GeneratedKeys) > 0 {
		dash.Id = resp.GeneratedKeys[0]
	}

	return nil
}

func GetDashboard(slug string, accountId int) (*models.Dashboard, error) {
	resp, err := r.Table("dashboards").
		GetAllByIndex("AccountIdSlug", []interface{}{accountId, slug}).
		Run(session)

	if err != nil {
		return nil, err
	}

	var dashboard models.Dashboard
	err = resp.One(&dashboard)
	if err != nil {
		return nil, err
	}

	return &dashboard, nil
}

func DeleteDashboard(slug string, accountId int) error {
	resp, err := r.Table("dashboards").
		GetAllByIndex("AccountIdSlug", []interface{}{accountId, slug}).
		Delete().RunWrite(session)

	if err != nil {
		return err
	}

	if resp.Deleted != 1 {
		return errors.New("Did not find dashboard to delete")
	}

	return nil
}

func SearchQuery(query string, accountId int) ([]*models.SearchResult, error) {
	docs, err := r.Table("dashboards").
		GetAllByIndex("AccountId", []interface{}{accountId}).
		Filter(r.Row.Field("Title").Match(".*")).Run(session)

	if err != nil {
		return nil, err
	}

	results := make([]*models.SearchResult, 0, 50)
	var dashboard models.Dashboard
	for docs.Next(&dashboard) {
		results = append(results, &models.SearchResult{
			Title: dashboard.Title,
			Id:    dashboard.Slug,
		})
	}

	return results, nil
}
