package modules

const (
	// All includes all modules necessary for Grafana to run as a standalone server
	All string = "all"

	Core             string = "core"
	GrafanaAPIServer string = "grafana-apiserver"
	StorageAPIServer string = "storage-apiserver"
)

var dependencyMap = map[string][]string{
	GrafanaAPIServer: {},
	StorageAPIServer: {},
	Core:             {},
	All:              {Core},
}
