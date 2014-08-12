package stores

import (
	"github.com/torkelo/grafana-pro/pkg/models"
)

type Store interface {
	GetById(id string) (*models.Dashboard, error)
	Save(dash *models.Dashboard) error
	Query(query string) ([]*models.SearchResult, error)
	Close()
}

func New() Store {
	return NewFileStore("data")
}
