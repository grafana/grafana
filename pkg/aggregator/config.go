package aggregator

import (
	"github.com/spf13/pflag"
	apiextensionsapiserver "k8s.io/apiextensions-apiserver/pkg/apiserver"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/apiserver/pkg/server/options"
	aggregatorapiserver "k8s.io/kube-aggregator/pkg/apiserver"
)

type ExtraConfig struct {
	ProxyClientCertFile string
	ProxyClientKeyFile  string

	DataPath string
}

type Config struct {
	Aggregator    *aggregatorapiserver.Config
	ApiExtensions *apiextensionsapiserver.Config

	AggregatorComplete    aggregatorapiserver.CompletedConfig
	ApiExtensionsComplete apiextensionsapiserver.CompletedConfig

	recommendedOptions *options.RecommendedOptions
	SharedConfig       *genericapiserver.RecommendedConfig
	extraConfig        *ExtraConfig
}

func (c *Config) AddFlags(fs *pflag.FlagSet) {
	if c == nil {
		return
	}

	c.recommendedOptions.AddFlags(fs)
}

func (c *Config) Complete() {
	if c == nil {
		return
	}

	c.ApiExtensionsComplete = c.ApiExtensions.Complete()
	c.AggregatorComplete = c.Aggregator.Complete()
}

func (ec *ExtraConfig) AddFlags(fs *pflag.FlagSet) {
	if ec == nil {
		return
	}

	fs.StringVar(&ec.ProxyClientCertFile, "proxy-client-cert-file", ec.ProxyClientCertFile,
		"path to proxy client cert file")

	fs.StringVar(&ec.ProxyClientKeyFile, "proxy-client-key-file", ec.ProxyClientKeyFile,
		"path to proxy client cert file")
}
