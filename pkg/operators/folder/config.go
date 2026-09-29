package folder

import (
	"fmt"

	"github.com/grafana/authlib/authn"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/metadata"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/util/flowcontrol"

	"github.com/grafana/grafana/pkg/clientauth"
	"github.com/grafana/grafana/pkg/setting"
)

// buildRestConfig builds the REST config for the folder apiserver from
// [operator] and [grpc_client_authentication] settings:
//
// [operator]
// folders_server_url =
// tls_insecure =
// [grpc_client_authentication]
// token =
// token_exchange_url =
func buildRestConfig(cfg *setting.Cfg) (*rest.Config, error) {
	operatorSec := cfg.SectionWithEnvOverrides("operator")

	serverURL := operatorSec.Key("folders_server_url").String()
	if serverURL == "" {
		return nil, fmt.Errorf("folders_server_url is required in [operator] section")
	}

	tlsConfig := rest.TLSClientConfig{
		Insecure: operatorSec.Key("tls_insecure").MustBool(false),
	}

	tokenExchangeClient, err := buildTokenExchangeClient(cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to create token exchange client: %w", err)
	}

	return &rest.Config{
		APIPath: "/apis",
		Host:    serverURL,
		WrapTransport: clientauth.NewStaticTokenExchangeTransportWrapper(
			tokenExchangeClient,
			folderGVR.Group,
			clientauth.WildcardNamespace,
		),
		TLSClientConfig: tlsConfig,
		RateLimiter:     flowcontrol.NewFakeAlwaysRateLimiter(),
	}, nil
}

func buildDynamicClient(cfg *setting.Cfg) (dynamic.Interface, error) {
	restConfig, err := buildRestConfig(cfg)
	if err != nil {
		return nil, err
	}

	dynClient, err := dynamic.NewForConfig(restConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create dynamic client: %w", err)
	}

	return dynClient, nil
}

// buildMetadataClient lists folders as metadata only (no spec/status), so the
// periodic re-list doesn't hold every folder's full body in memory.
func buildMetadataClient(cfg *setting.Cfg) (metadata.Interface, error) {
	restConfig, err := buildRestConfig(cfg)
	if err != nil {
		return nil, err
	}

	metadataClient, err := metadata.NewForConfig(restConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create metadata client: %w", err)
	}

	return metadataClient, nil
}

func buildTokenExchangeClient(cfg *setting.Cfg) (*authn.TokenExchangeClient, error) {
	gRPCAuth := cfg.SectionWithEnvOverrides("grpc_client_authentication")

	token := gRPCAuth.Key("token").String()
	if token == "" {
		return nil, fmt.Errorf("token is required in [grpc_client_authentication] section")
	}
	tokenExchangeURL := gRPCAuth.Key("token_exchange_url").String()
	if tokenExchangeURL == "" {
		return nil, fmt.Errorf("token_exchange_url is required in [grpc_client_authentication] section")
	}

	return authn.NewTokenExchangeClient(authn.TokenExchangeConfig{
		TokenExchangeURL: tokenExchangeURL,
		Token:            token,
	})
}
