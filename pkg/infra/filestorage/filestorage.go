package filestorage

import (
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	ServiceName = "FileStorage"
)

func ProvideService(cfg *setting.Cfg, sqlStore *sqlstore.SQLStore) (FileStorage, error) {
	return &baseFilestorageService{
		wrapped: &dbFileStorage{
			db:  sqlStore,
			log: log.New("dbFileStorage"),
		},
		log: log.New("baseFileStorage"),
	}, nil
}
