package modules

const (
	// All includes all modules necessary for Grafana to run as a standalone server
	All string = "all"

	Core                  string = "core"
	MemberlistKV          string = "memberlistkv"
	GrafanaAPIServer      string = "grafana-apiserver"
	StorageRing           string = "storage-ring"
	Distributor           string = "distributor"
	StorageServer         string = "storage-server"
	ZanzanaServer         string = "zanzana-server"
	InstrumentationServer string = "instrumentation-server"
	FrontendServer        string = "frontend-server"
)

var dependencyMap = map[string][]string{
	MemberlistKV:     {InstrumentationServer},
	StorageRing:      {InstrumentationServer, MemberlistKV},
	GrafanaAPIServer: {InstrumentationServer},
	StorageServer:    {InstrumentationServer, StorageRing},
	ZanzanaServer:    {InstrumentationServer},
	Distributor:      {InstrumentationServer, MemberlistKV, StorageRing},
	Core:             {},
	All:              {Core},
	FrontendServer:   {},
}
