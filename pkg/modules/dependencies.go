package modules

const (
	// All includes all modules necessary for Grafana to run as a standalone server
	All string = "all"

	Core string = "core"
)

var dependencyMap = map[string][]string{
	Core: {},
	All:  {Core},
}
