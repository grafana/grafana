package zanzana

import (
	"github.com/openfga/openfga/pkg/storage"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"

	"github.com/grafana/grafana/pkg/services/authz/zanzana/store"
)

func NewStore(settingsProvider setting.SettingsProvider, logger log.Logger) (storage.OpenFGADatastore, error) {
	return store.NewStore(settingsProvider, logger)
}

func NewEmbeddedStore(settingsProvider setting.SettingsProvider, db db.DB, logger log.Logger) (storage.OpenFGADatastore, error) {
	return store.NewEmbeddedStore(settingsProvider, db, logger)
}
