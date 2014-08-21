package stores

import (
	"github.com/torkelo/grafana-pro/pkg/models"
)

type Store interface {
	GetDashboardByTitle(id string, accountId string) (*models.Dashboard, error)
	SaveDashboard(dash *models.Dashboard) error
	Query(query string) ([]*models.SearchResult, error)
	Close()
}

func New() Store {
	return NewRethinkStore(&RethinkCfg{DatabaseName: "grafana"})
}
