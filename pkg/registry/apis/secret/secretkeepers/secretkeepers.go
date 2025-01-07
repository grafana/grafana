package secretkeepers

import (
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/registry/apis/secret"
	"github.com/grafana/grafana/pkg/registry/apis/secret/secretkeepers/sqlkeeper"
)

type Service interface {
	// TODO: pass context, type, config
	GetKeeper() (secret.Keeper, error)
}

type OSSKeeperService struct {
	db db.DB
}

func ProvideService(db db.DB) (OSSKeeperService, error) {
	return OSSKeeperService{db: db}, nil
}

func (ks OSSKeeperService) GetKeeper() (secret.Keeper, error) {
	// Default keeper
	return sqlkeeper.NewSQLKeeper(ks.db)
}
