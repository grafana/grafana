package zanzana

import (
	"github.com/openfga/openfga/pkg/server"
	"github.com/openfga/openfga/pkg/storage"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/setting"

	zserver "github.com/grafana/grafana/pkg/services/authz/zanzana/server"
)

func NewServer(store storage.OpenFGADatastore, logger log.Logger) (*server.Server, error) {
	return zserver.New(store, logger)
}

func StartOpenFGAHttpSever(cfg *setting.Cfg, srv grpcserver.Provider, logger log.Logger) error {
	return zserver.StartOpenFGAHttpSever(cfg, srv, logger)
}
