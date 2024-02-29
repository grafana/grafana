package aggregator

import (
	serviceclientset "github.com/grafana/grafana/pkg/generated/clientset/versioned"
	informersv0alpha1 "github.com/grafana/grafana/pkg/generated/informers/externalversions"
	aggregatorapiserver "k8s.io/kube-aggregator/pkg/apiserver"
)

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

type Config struct {
	KubeAggregatorConfig *aggregatorapiserver.Config
	Informers            informersv0alpha1.SharedInformerFactory
	RemoteServicesConfig *RemoteServicesConfig
}

// remoteServices may be nil, when not using aggregation
func NewConfig(aggregator *aggregatorapiserver.Config, informers informersv0alpha1.SharedInformerFactory, remoteServices *RemoteServicesConfig) *Config {
	return &Config{
		aggregator,
		informers,
		remoteServices,
	}
}
