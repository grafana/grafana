package modules

const (
	// All includes all modules necessary for Grafana to run as a standalone server
	All string = "all"

	// GrafanaAPIServer is the Kubertenes API server for Grafana Resources
	GrafanaAPIServer string = "grafana-apiserver"
)

var dependencyMap = map[string][]string{
	GrafanaAPIServer: {},
	All:              {},
}
