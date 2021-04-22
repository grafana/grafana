package main

import (
	"os"

	"github.com/go-chi/chi"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/backend/resource/httpadapter"
)

const pluginID = "grafana-marketplace-app"

func main() {
	backend.SetupPluginEnvironment(pluginID)

	logger := log.New()

	srv := &server{
		logger: logger,
	}

	r := chi.NewRouter()

	srv.registerRoutes(r)

	resourceHandler := httpadapter.New(r)

	err := backend.Serve(backend.ServeOpts{
		CallResourceHandler: resourceHandler,
	})

	if err != nil {
		logger.Error(err.Error())
		os.Exit(1)
	}
}
