package client

import (
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

// ProvideRESTConfig returns a rest.Config for the current environment.
func ProvideRESTConfig() (*rest.Config, error) {
	config, err := rest.InClusterConfig()
	if err == nil {
		return config, nil
	}

	loadingRules := clientcmd.NewDefaultClientConfigLoadingRules()
	apiConfig, err := loadingRules.Load()
	if err != nil {
		return nil, err
	}

	clientConfig := clientcmd.NewDefaultClientConfig(*apiConfig, &clientcmd.ConfigOverrides{})
	return clientConfig.ClientConfig()
}
