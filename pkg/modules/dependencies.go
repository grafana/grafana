package modules

const (
	// All includes all modules necessary for Grafana to run as a standalone application.
	All string = "all"
	// BackgroundServices includes all Grafana services that run in the background
	BackgroundServices string = "background-services"
	// CertGenerator generates certificates for grafana-apiserver
	CertGenerator string = "cert-generator"
	// GrafanaAPIServer is the Kubertenes API server for Grafana Resources
	GrafanaAPIServer string = "grafana-apiserver"
	// HTTPServer is the HTTP server for Grafana
	HTTPServer string = "http-server"
	// SecretMigrator handles legacy secrets migrations
	SecretMigrator string = "secret-migrator"
)

// dependencyMap defines Module Targets => Dependencies
var dependencyMap = map[string][]string{
	BackgroundServices: {HTTPServer},
	CertGenerator:      {},
	GrafanaAPIServer:   {CertGenerator},
	All:                {BackgroundServices},
}
