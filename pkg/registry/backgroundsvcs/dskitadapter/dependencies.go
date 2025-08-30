package dskitadapter

import "github.com/grafana/grafana/pkg/modules"

const (
	BackgroundServices = "background-services"
	Core               = "core"
	All                = "all"
)

func dependencyMap() map[string][]string {
	return map[string][]string{
		"tracing":                {},
		modules.GrafanaAPIServer: {"tracing"},
		Core:                     {modules.GrafanaAPIServer},
		BackgroundServices:       {},
		All:                      {Core, BackgroundServices},
	}
}
