package stores

import (
	"github.com/torkelo/grafana-pro/pkg/models"
)

type Store interface {
	GetDashboard(slug string, accountId int) (*models.Dashboard, error)
	SaveDashboard(dash *models.Dashboard) error
	DeleteDashboard(slug string, accountId int) error
	Query(query string, acccountId int) ([]*models.SearchResult, error)
	SaveUserAccount(acccount *models.UserAccount) error
	GetUserAccountLogin(emailOrName string) (*models.UserAccount, error)
	Close()
}

func New() Store {
	return NewRethinkStore(&RethinkCfg{DatabaseName: "grafana"})
}
