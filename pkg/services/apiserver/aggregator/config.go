package aggregator

type RemoteService struct {
	Group   string `yaml:"group"`
	Version string `yaml:"version"`
	Host    string `yaml:"host"`
	Port    int32  `yaml:"port"`
}

type RemoteServicesConfig struct {
	ExternalNamesNamespace string
	CABundle               string
	Services               []RemoteService
}
