package client

import (
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"k8s.io/client-go/rest"
)

// ProvideRESTConfig returns a rest.Config for the current environment.
func ProvideRESTConfig(toggles featuremgmt.FeatureToggles) (*rest.Config, error) {
	if !toggles.IsEnabled(featuremgmt.FlagK8s) {
		return &rest.Config{}, nil
	}
	//config, err := rest.InClusterConfig()
	//if err == nil {
	//	return config, nil
	//}

	//loadingRules := clientcmd.NewDefaultClientConfigLoadingRules()
	//apiConfig, err := loadingRules.Load()
	//if err != nil {
	//	return nil, err
	//}

	//clientConfig := clientcmd.NewDefaultClientConfig(*apiConfig, &clientcmd.ConfigOverrides{})
	//return clientConfig.ClientConfig()
	return &rest.Config{Host: "http://127.0.0.1:6443"}, nil
}
