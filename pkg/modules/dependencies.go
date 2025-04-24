package modules

const (
	// All includes all modules necessary for Grafana to run as a standalone server
	All string = "all"

	Core                  string = "core"
	GrafanaAPIServer      string = "grafana-apiserver"
	StorageRing           string = "storage-ring"
	StorageServer         string = "storage-server"
	ZanzanaServer         string = "zanzana-server"
	InstrumentationServer string = "instrumentation-server"
)

var dependencyMap = map[string][]string{
	StorageRing:      {InstrumentationServer},
	GrafanaAPIServer: {InstrumentationServer},
	StorageServer:    {InstrumentationServer, StorageRing},
	ZanzanaServer:    {InstrumentationServer},
	Core:             {},
	All:              {Core},
}
