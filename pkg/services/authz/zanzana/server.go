package zanzana

import (
	"net/http"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	openfgaserver "github.com/openfga/openfga/pkg/server"
	openfgastorage "github.com/openfga/openfga/pkg/storage"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/server"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/setting"
)

func NewServer(cfg setting.ZanzanaServerSettings, openfga openfgav1.OpenFGAServiceServer, logger log.Logger) (*server.Server, error) {
	return server.NewServer(cfg, openfga, logger)
}

func NewOpenFGAServer(cfg setting.ZanzanaServerSettings, store openfgastorage.OpenFGADatastore, logger log.Logger) (*openfgaserver.Server, error) {
	return server.NewOpenFGAServer(cfg, store, logger)
}

func NewOpenFGAHttpServer(cfg setting.ZanzanaServerSettings, srv grpcserver.Provider) (*http.Server, error) {
	return server.NewOpenFGAHttpServer(cfg, srv)
}
