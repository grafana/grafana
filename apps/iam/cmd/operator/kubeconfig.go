package main

import (
	"fmt"
	"net/http"

	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/transport"

	"github.com/grafana/authlib/authn"
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
func LoadKubeConfigFromFolderAppURL(folderAppURL, exchangeUrl, authToken, namespace string) (*kubeconfig.NamespacedConfig, error) {
	tokenExchangeClient, err := authn.NewTokenExchangeClient(authn.TokenExchangeConfig{
		TokenExchangeURL: exchangeUrl,
		Token:            authToken,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create token exchange client: %w", err)
	}

	return &kubeconfig.NamespacedConfig{
		RestConfig: rest.Config{
			APIPath: "/apis",
			Host:    folderAppURL,
			WrapTransport: transport.WrapperFunc(func(rt http.RoundTripper) http.RoundTripper {
				return &authRoundTripper{
					tokenExchangeClient: tokenExchangeClient,
					transport:           rt,
				}
			}),
			TLSClientConfig: rest.TLSClientConfig{
				Insecure: true,
			},
		},
		Namespace: namespace,
	}, nil
}

// LoadKubeConfigFromFile loads a NamespacedConfig from a file on-disk (such as a mounted secret)
func LoadKubeConfigFromFile(configPath string) (*kubeconfig.NamespacedConfig, error) {
	// Load the kubeconfig file
	config, err := clientcmd.LoadFromFile(configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to load kubeconfig from %s: %w", configPath, err)
	}

	// Build the REST config from the kubeconfig
	restConfig, err := clientcmd.NewDefaultClientConfig(*config, &clientcmd.ConfigOverrides{}).ClientConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to create REST config: %w", err)
	}

	// Get the namespace from the current context, default to "default" if not set
	namespace := "default"
	if config.CurrentContext != "" {
		if context, exists := config.Contexts[config.CurrentContext]; exists && context.Namespace != "" {
			namespace = context.Namespace
		}
	}

	restConfig.APIPath = "/apis"

	return &kubeconfig.NamespacedConfig{
		RestConfig: *restConfig,
		Namespace:  namespace,
	}, nil
}
