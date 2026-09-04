//go:build !enterprise && !pro
// +build !enterprise,!pro

package wire

import (
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/server"
)

// provideIsolatedRegisterer keeps the plugin router's dependency graph off the
// metrics registry the rest of the process is using. See PluginRouterDepsSet;
// it lives here rather than beside that set because the generated code refers
// to it, and the set's file is only compiled while generating.
func provideIsolatedRegisterer() prometheus.Registerer {
	return prometheus.NewRegistry()
}

func init() {
	server.RegisterInitializers(
		Initialize,
		InitializeForTest,
		InitializeForCLI,
		InitializeAPIServerFactory,
		InitializeRouterFactory,
		InitializePluginRouterDeps,
	)
}
