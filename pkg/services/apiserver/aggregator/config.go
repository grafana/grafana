package aggregator

import serviceclientset "github.com/grafana/grafana/pkg/generated/clientset/versioned"

type RemoteService struct {
	Group   string `yaml:"group"`
	Version string `yaml:"version"`
	Host    string `yaml:"host"`
	Port    int32  `yaml:"port"`
}

type RemoteServicesConfig struct {
	ExternalNamesNamespace string
	InsecureSkipTLSVerify  bool
	CABundle               []byte
	Services               []RemoteService
	serviceClientSet       *serviceclientset.Clientset
}
