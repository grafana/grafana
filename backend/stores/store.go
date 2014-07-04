package stores

import (
	"github.com/torkelo/grafana-pro/backend/models"
)

type Store interface {
	GetById(id string) (*models.Dashboard, error)
}

func New() Store {
	return NewFileStore("data")
}
