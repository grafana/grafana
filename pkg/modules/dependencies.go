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
	AuthnServer             string = "authn-server"
	InstrumentationServer   string = "instrumentation-server"
	GRPCServer              string = "grpc-server"
	UnifiedBackend          string = "unified-backend"
	UnifiedVectorBackend    string = "unified-vector-backend"
	NATS                    string = "nats"
	FrontendServer          string = "frontend-server"
	Router                  string = "router"
	OperatorServer          string = "operator"

	// CloudCoreAppsServer is registered by enterprise builds.
	CloudCoreAppsServer string = "cloud-core-apps-server"
	// CloudPluginOperator is registered by enterprise builds.
	CloudPluginOperator string = "cloud-plugin-operator"
	// CloudPluginManifests is registered by enterprise builds.
	CloudPluginManifests string = "cloud-plugin-manifests"
)

// CloudCoreAppsServerPath is the path cloud-core-apps-server serves its apps
// at on the instrumentation server.
const CloudCoreAppsServerPath = "/cloud-core-apps-server/apps"

var dependencyMap = map[string][]string{
	MemberlistKV:     {InstrumentationServer},
	SearchServerRing: {InstrumentationServer, MemberlistKV},
	GrafanaAPIServer: {InstrumentationServer},

	// TODO: remove SearchServerRing once we only use sharding in SearchServer
	StorageServer: {UnifiedBackend, UnifiedVectorBackend, InstrumentationServer, GRPCServer, SearchServerRing},
	SearchServer:  {UnifiedBackend, UnifiedVectorBackend, InstrumentationServer, GRPCServer, SearchServerRing},

	// UnifiedBackend publishes resource watch notifications through the NATS
	// publisher, so NATS must be initialized first. It also depends on
	// UnifiedVectorBackend so the vector backend is constructed before
	// the backend's tenant deleter.
	NATS:           {InstrumentationServer},
	UnifiedBackend: {NATS, UnifiedVectorBackend},

	ZanzanaServer:           {InstrumentationServer},
	SearchServerDistributor: {InstrumentationServer, GRPCServer, MemberlistKV, SearchServerRing},
	Core:                    {},
	All:                     {Core},
	FrontendServer:          {},
	Router:                  {InstrumentationServer, UnifiedBackend},
	OperatorServer:          {InstrumentationServer},
}
