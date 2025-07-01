package modules

const (
	// All includes all modules necessary for Grafana to run as a standalone server
	All string = "all"

	Core                   string = "core"
	MemberlistKV           string = "memberlistkv"
	GrafanaAPIServer       string = "grafana-apiserver"
	IndexServerRing        string = "index-server-ring"
	IndexServerDistributor string = "index-server-distributor"
	StorageServer          string = "storage-server"
	ZanzanaServer          string = "zanzana-server"
	InstrumentationServer  string = "instrumentation-server"
	FrontendServer         string = "frontend-server"
)

var dependencyMap = map[string][]string{
	MemberlistKV:           {InstrumentationServer},
	IndexServerRing:        {InstrumentationServer, MemberlistKV},
	GrafanaAPIServer:       {InstrumentationServer},
	StorageServer:          {InstrumentationServer, IndexServerRing},
	ZanzanaServer:          {InstrumentationServer},
	IndexServerDistributor: {InstrumentationServer, MemberlistKV, IndexServerRing},
	Core:                   {},
	All:                    {Core},
	FrontendServer:         {},
}
