package modules

const (
	// All includes all modules necessary for Grafana to run as a standalone application.
	All string = "all"
	// BackgroundServices includes all Grafana services that run in the background
	BackgroundServices string = "background-services"
)

// dependencyMap defines Module Targets => Dependencies
var dependencyMap = map[string][]string{
	All: {BackgroundServices},
}
