package modules

const (
	All                string = "all"
	BackgroundServices string = "background-services"
)

var dependencyMap = map[string][]string{
	All: {BackgroundServices},
}
