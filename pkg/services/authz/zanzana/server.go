package zanzana

import (
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/openfga/openfga/pkg/server"
	"github.com/openfga/openfga/pkg/storage"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/setting"

	zserver "github.com/grafana/grafana/pkg/services/authz/zanzana/server"
)

func NewOpenFGAServer(cfg *setting.Cfg, store storage.OpenFGADatastore, logger log.Logger) (*server.Server, error) {
	return zserver.NewOpenFGA(&cfg.Zanzana, store, logger)
}

func NewAuthzServer(openfga openfgav1.OpenFGAServiceServer) *zserver.Server {
	return zserver.NewAuthz(openfga)
}

func StartOpenFGAHttpSever(cfg *setting.Cfg, srv grpcserver.Provider, logger log.Logger) error {
	return zserver.StartOpenFGAHttpSever(cfg, srv, logger)
}
