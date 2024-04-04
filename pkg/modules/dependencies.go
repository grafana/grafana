package modules

const (
	// All includes all modules necessary for Grafana to run as a standalone server
	All string = "all"

	Core                  string = "core"
	GrafanaAPIServer      string = "grafana-apiserver"
	StorageServer         string = "storage-server"
	InstrumentationServer string = "instrumentation-server"
)

var dependencyMap = map[string][]string{
	InstrumentationServer: {},
	GrafanaAPIServer:      {},
	StorageServer:         {},
	Core:                  {},
	All:                   {Core},
}
