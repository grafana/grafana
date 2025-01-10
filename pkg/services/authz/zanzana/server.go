package zanzana

import (
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	openfgaserver "github.com/openfga/openfga/pkg/server"
	openfgastorage "github.com/openfga/openfga/pkg/storage"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/server"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/setting"
)

func NewServer(cfg setting.ZanzanaSettings, openfga openfgav1.OpenFGAServiceServer, logger log.Logger) (*server.Server, error) {
	return server.NewServer(cfg, openfga, logger)
}

func NewOpenFGAServer(cfg setting.ZanzanaSettings, store openfgastorage.OpenFGADatastore, logger log.Logger) (*openfgaserver.Server, error) {
	return server.NewOpenFGA(cfg, store, logger)
}

func StartOpenFGAHttpSever(cfg setting.ZanzanaSettings, srv grpcserver.Provider, logger log.Logger) error {
	return server.StartOpenFGAHttpSever(cfg, srv, logger)
}
