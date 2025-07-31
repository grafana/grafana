package main

import (
	"fmt"
	"os"

	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"

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
	kubeconfigPath := "data/grafana-apiserver/grafana.kubeconfig"

	// Read the kubeconfig file from disk
	kubeconfigBytes, err := os.ReadFile(kubeconfigPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read kubeconfig file from %s: %w", kubeconfigPath, err)
	}

	// Convert the kubeconfig bytes to a rest.Config
	restConfig, err := clientcmd.RESTConfigFromKubeConfig(kubeconfigBytes)
	if err != nil {
		return nil, fmt.Errorf("failed to parse kubeconfig: %w", err)
	}

	// Set the API path for custom resources
	restConfig.APIPath = "/apis"

	return &kubeconfig.NamespacedConfig{
		RestConfig: *restConfig,
		Namespace:  "default", // Default namespace, could be made configurable
	}, nil
}
