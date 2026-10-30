package folder

import (
	"crypto/x509"
	"fmt"
	"os"

	"github.com/grafana/authlib/authn"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/trace"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/util/flowcontrol"

	"github.com/grafana/grafana/pkg/clientauth"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// buildRESTClient builds a client for one API group's server, so folders and dashboards can live on
// different apiservers. Every client shares the authentication settings [operator] and
// [grpc_client_authentication], and its token is exchanged for the group's audience.
//
// [operator]
// folders_server_url =
// dashboards_server_url =
// tls_insecure =
// tls_cert_file =
// tls_key_file =
// tls_ca_file =
// [grpc_client_authentication]
// token =
// token_exchange_url =
func buildRESTClient(cfg *setting.Cfg, serverURLKey, group string) (rest.Interface, error) {
	operatorSec := cfg.SectionWithEnvOverrides("operator")

	serverURL := operatorSec.Key(serverURLKey).String()
	if serverURL == "" {
		return nil, fmt.Errorf("%s is required in [operator] section", serverURLKey)
	}

	tlsConfig, err := buildTLSConfig(
		operatorSec.Key("tls_insecure").MustBool(false),
		operatorSec.Key("tls_cert_file").String(),
		operatorSec.Key("tls_key_file").String(),
		operatorSec.Key("tls_ca_file").String(),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to build TLS configuration: %w", err)
	}

	tokenExchangeClient, err := buildTokenExchangeClient(cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to create token exchange client: %w", err)
	}

	restConfig := &rest.Config{
		APIPath: "/apis",
		Host:    serverURL,
		WrapTransport: clientauth.NewStaticTokenExchangeTransportWrapper(
			tokenExchangeClient,
			group,
			clientauth.WildcardNamespace,
		),
		TLSClientConfig: tlsConfig,
		RateLimiter:     flowcontrol.NewFakeAlwaysRateLimiter(),
	}

	client, err := rest.UnversionedRESTClientFor(dynamic.ConfigFor(restConfig))
	if err != nil {
		return nil, fmt.Errorf("failed to create %s REST client: %w", group, err)
	}

	return client, nil
}

func buildTLSConfig(insecure bool, certFile, keyFile, caFile string) (rest.TLSClientConfig, error) {
	tlsConfig := rest.TLSClientConfig{
		Insecure: insecure,
	}

	if certFile != "" && keyFile != "" {
		tlsConfig.CertFile = certFile
		tlsConfig.KeyFile = keyFile
	}

	if caFile != "" {
		// caFile is set in operator.ini file
		// nolint:gosec
		caCert, err := os.ReadFile(caFile)
		if err != nil {
			return tlsConfig, fmt.Errorf("failed to read CA certificate file: %w", err)
		}

		caCertPool := x509.NewCertPool()
		if !caCertPool.AppendCertsFromPEM(caCert) {
			return tlsConfig, fmt.Errorf("failed to parse CA certificate")
		}

		tlsConfig.CAData = caCert
	}

	return tlsConfig, nil
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

// buildSearchClient connects straight to unified storage, as the provisioning operators do, since
// finding a folder's children needs the search index and there is no global search endpoint yet.
//
// [unified_storage]
// grpc_address =
// grpc_index_address =
// allow_insecure =
// audiences =
// [grpc_client_authentication]
// token_namespace =
func buildSearchClient(cfg *setting.Cfg, tracer trace.Tracer, registry prometheus.Registerer) (client resource.ResourceClient, closeConns func(), err error) {
	sec := cfg.SectionWithEnvOverrides("unified_storage")
	address := sec.Key("grpc_address").String()
	if address == "" {
		return nil, nil, fmt.Errorf("grpc_address is required in [unified_storage] section")
	}
	// A constant label rather than a metric-name prefix keeps both connections under the canonical
	// metric names while letting them share the registry.
	conn, err := unified.GrpcConn(address, prometheus.WrapRegistererWith(prometheus.Labels{"component": "storage"}, registry))
	if err != nil {
		return nil, nil, fmt.Errorf("create unified storage gRPC connection: %w", err)
	}

	indexConn := conn
	if indexAddress := sec.Key("grpc_index_address").String(); indexAddress != "" {
		indexConn, err = unified.GrpcConn(indexAddress, prometheus.WrapRegistererWith(prometheus.Labels{"component": "index"}, registry))
		if err != nil {
			_ = conn.Close()
			return nil, nil, fmt.Errorf("create unified storage index gRPC connection: %w", err)
		}
	}

	audiences := sec.Key("audiences").Strings("|")
	if len(audiences) == 0 {
		audiences = []string{"resourceStore"}
	}

	gRPCAuth := cfg.SectionWithEnvOverrides("grpc_client_authentication")
	closeConns = func() {
		_ = conn.Close()
		if indexConn != conn {
			_ = indexConn.Close()
		}
	}
	client, err = resource.NewStandaloneRemoteResourceClient(tracer, conn, indexConn, resource.RemoteResourceClientConfig{
		Token:            gRPCAuth.Key("token").String(),
		TokenExchangeURL: gRPCAuth.Key("token_exchange_url").String(),
		Namespace:        gRPCAuth.Key("token_namespace").String(),
		AllowInsecure:    sec.Key("allow_insecure").MustBool(false),
		Audiences:        audiences,
	})
	if err != nil {
		closeConns()
		return nil, nil, err
	}
	return client, closeConns, nil
}
