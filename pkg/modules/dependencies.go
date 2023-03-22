package modules

const (
	All                string = "all"
	BackgroundServices string = "background-services"
)

// dependencyMap defines Module Targets => Dependencies
var dependencyMap = map[string][]string{
	All: {BackgroundServices},
}
