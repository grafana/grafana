package modules

const (
	// All includes all modules necessary for Grafana to run as a standalone server
	All string = "all"

	Core                    string = "core"
	MemberlistKV            string = "memberlistkv"
	GrafanaAPIServer        string = "grafana-apiserver"
	SearchServerRing        string = "search-server-ring"
	SearchServerDistributor string = "search-server-distributor"
	StorageServer           string = "storage-server"
	SearchServer            string = "search-server"
	ZanzanaServer           string = "zanzana-server"
	InstrumentationServer   string = "instrumentation-server"
	GRPCServer              string = "grpc-server"
	UnifiedBackend          string = "unified-backend"
	FrontendServer          string = "frontend-server"
	OperatorServer          string = "operator"
)

var dependencyMap = map[string][]string{
	MemberlistKV:     {InstrumentationServer},
	SearchServerRing: {InstrumentationServer, MemberlistKV},
	GrafanaAPIServer: {InstrumentationServer},

	// TODO: remove SearchServerRing once we only use sharding in SearchServer
	StorageServer: {UnifiedBackend, InstrumentationServer, GRPCServer, SearchServerRing},
	SearchServer:  {UnifiedBackend, InstrumentationServer, GRPCServer, SearchServerRing},

	ZanzanaServer:           {InstrumentationServer},
	SearchServerDistributor: {InstrumentationServer, GRPCServer, MemberlistKV, SearchServerRing},
	Core:                    {},
	All:                     {Core},
	FrontendServer:          {},
	OperatorServer:          {InstrumentationServer},
}
