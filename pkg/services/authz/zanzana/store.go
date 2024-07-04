package zanzana

import (
	"github.com/openfga/openfga/pkg/storage"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"

	"github.com/grafana/grafana/pkg/services/authz/zanzana/store"
)

func NewStore(cfg *setting.Cfg, logger log.Logger) (storage.OpenFGADatastore, error) {
	return store.NewStore(cfg, logger)
}
func NewEmbeddedStore(cfg *setting.Cfg, db db.DB, logger log.Logger) (storage.OpenFGADatastore, error) {
	return store.NewEmbeddedStore(cfg, db, logger)
}
