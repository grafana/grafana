package modules

const (
	// All includes all modules necessary for Grafana to run as a standalone application.
	All string = "all"
)

// dependencyMap defines Module Targets => Dependencies
var dependencyMap = map[string][]string{
	All: {},
}
