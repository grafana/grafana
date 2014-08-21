package stores

import (
	"time"

	log "github.com/alecthomas/log4go"
	r "github.com/dancannon/gorethink"
	"github.com/torkelo/grafana-pro/pkg/models"
)

type rethinkStore struct {
	session *r.Session
}

type RethinkCfg struct {
	DatabaseName string
}

func NewRethinkStore(config *RethinkCfg) *rethinkStore {
	log.Info("Initializing rethink storage")

	session, err := r.Connect(r.ConnectOpts{
		Address:     "localhost:28015",
		Database:    config.DatabaseName,
		MaxIdle:     10,
		IdleTimeout: time.Second * 10,
	})

	if err != nil {
		log.Crash("Failed to connect to rethink database %v", err)
	}

	r.DbCreate(config.DatabaseName).Exec(session)
	r.Db(config.DatabaseName).TableCreate("dashboards").Exec(session)
	r.Db(config.DatabaseName).Table("dashboards").IndexCreateFunc("AccountIdTitle", func(row r.Term) interface{} {
		return []interface{}{row.Field("AccountId"), row.Field("Title")}
	}).Exec(session)

	return &rethinkStore{
		session: session,
	}
}

func (self *rethinkStore) SaveDashboard(dash *models.Dashboard) error {
	resp, err := r.Table("dashboards").Insert(dash).RunWrite(self.session)
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

func (self *rethinkStore) GetDashboardByTitle(title string, accountId string) (*models.Dashboard, error) {
	resp, err := r.Table("dashboards").GetAllByIndex("AccountIdTitle", []interface{}{accountId, title}).Run(self.session)
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

func (self *rethinkStore) Query(query string) ([]*models.SearchResult, error) {

	docs, err := r.Table("dashboards").Filter(r.Row.Field("Title").Match(".*")).Run(self.session)
	if err != nil {
		return nil, err
	}

	results := make([]*models.SearchResult, 0, 50)
	var dashboard models.Dashboard
	for docs.Next(&dashboard) {
		log.Info("title: ", dashboard.Title)
		results = append(results, &models.SearchResult{
			Title: dashboard.Title,
			Id:    dashboard.Id,
		})
	}

	return results, nil
}

func (self *rethinkStore) Close() {}
