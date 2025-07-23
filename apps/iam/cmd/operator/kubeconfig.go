package main

import (
	"fmt"

	"k8s.io/client-go/rest"

	"github.com/grafana/grafana-app-sdk/plugin/kubeconfig"
)

// LoadInClusterConfig loads a kubernetes in-cluster config.
// Since the in-cluster config doesn't have a namespace, it defaults to "default"
func LoadInClusterConfig() (*kubeconfig.NamespacedConfig, error) {
	cfg, err := rest.InClusterConfig()
	if err != nil {
		return nil, err
	}
	cfg.APIPath = "/apis"
	return &kubeconfig.NamespacedConfig{
		RestConfig: *cfg,
		Namespace:  "default",
	}, nil
}

// LoadKubeConfigFromEnv loads a NamespacedConfig from the value of an environment variable
func LoadKubeConfigFromEnv() (*kubeconfig.NamespacedConfig, error) {
	// TODO
	return nil, fmt.Errorf("not implemented")
}

// LoadKubeConfigFromFile loads a NamespacedConfig from a file on-disk (such as a mounted secret)
func LoadKubeConfigFromFile() (*kubeconfig.NamespacedConfig, error) {
	// TODO
	return nil, fmt.Errorf("not implemented")
}
