package testdatasourcev2

import (
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/resource/httpadapter"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/coreplugin"
	"github.com/grafana/grafana/pkg/registry"
)

func init() {
	registry.RegisterService(&testdataV2{})
}

type testdataV2 struct {
	BackendPluginManager backendplugin.Manager `inject:""`
	logger               log.Logger
}

func (td *testdataV2) Init() error {
	td.logger = log.New("tsdb.testdatav2")
	mux := http.NewServeMux()
	td.registerRoutes(mux)
	factory := coreplugin.New(backend.ServeOpts{
		CallResourceHandler: httpadapter.New(mux),
	})
	err := td.BackendPluginManager.Register("testdata", factory)
	if err != nil {
		td.logger.Error("Failed to register plugin", "error", err)
	}
	return nil
}
