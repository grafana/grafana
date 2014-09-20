package stores

import (
	"github.com/torkelo/grafana-pro/pkg/models"
)

type Store interface {
	GetDashboard(slug string, accountId int) (*models.Dashboard, error)
	SaveDashboard(dash *models.Dashboard) error
	DeleteDashboard(slug string, accountId int) error
	Query(query string, acccountId int) ([]*models.SearchResult, error)
	CreateAccount(acccount *models.Account) error
	UpdateAccount(acccount *models.Account) error
	GetAccountByLogin(emailOrName string) (*models.Account, error)
	GetAccount(id int) (*models.Account, error)
	Close()
}

func New() Store {
	return NewRethinkStore(&RethinkCfg{DatabaseName: "grafana"})
}
