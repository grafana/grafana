package modules

const (
	// All includes all modules necessary for Grafana to run as a standalone server
	All string = "all"

	Core                  string = "core"
	GrafanaAPIServer      string = "grafana-apiserver"
	StorageServer         string = "storage-server"
	ZanzanaServer         string = "zanzana-server"
	InstrumentationServer string = "instrumentation-server"
	FrontendServer        string = "frontend-server"
)

var dependencyMap = map[string][]string{
	GrafanaAPIServer: {InstrumentationServer},
	StorageServer:    {InstrumentationServer},
	ZanzanaServer:    {InstrumentationServer},
	Core:             {},
	All:              {Core},
	FrontendServer:   {},
}
