package main

import (
	"crypto/tls"
	"fmt"
	"net/http"
	"net/url"

	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"

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
func LoadKubeConfigFromFolderAppURL(folderAppURL, exchangeUrl, authToken string) (*kubeconfig.NamespacedConfig, error) {
	tokenExchangeClient, err := authn.NewTokenExchangeClient(authn.TokenExchangeConfig{
		TokenExchangeURL: exchangeUrl,
		Token:            authToken,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create token exchange client: %w", err)
	}

	proxyURL, err := url.Parse(folderAppURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse folder app URL: %w", err)
	}

	transport := &http.Transport{
		Proxy: http.ProxyURL(proxyURL),
		TLSClientConfig: &tls.Config{
			InsecureSkipVerify: true,
		},
	}

	roundTripper := &authRoundTripper{
		tokenExchangeClient: tokenExchangeClient,
		transport:           transport,
	}

	return &kubeconfig.NamespacedConfig{
		RestConfig: rest.Config{
			Host:      folderAppURL,
			Transport: roundTripper,
		},
		Namespace: "default",
	}, nil
}

// LoadKubeConfigFromFile loads a NamespacedConfig from a file on-disk (such as a mounted secret)
func LoadKubeConfigFromFile(configPath string) (*kubeconfig.NamespacedConfig, error) {
	// configPath := "/etc/grafana/grafana-apiserver/grafana.kubeconfig"
	// host.docker.internal:6446
	// host.docker.internal:6481

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
