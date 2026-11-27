package folder

import (
	"fmt"

	"github.com/grafana/grafana/pkg/operators/runner"

	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/trace"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"

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
func buildRESTClient(clients *runner.Clients, serverURLKey, group string) (rest.Interface, error) {
	restConfig, err := clients.RESTConfig(serverURLKey, group)
	if err != nil {
		return nil, err
	}
	client, err := rest.UnversionedRESTClientFor(dynamic.ConfigFor(restConfig))
	if err != nil {
		return nil, fmt.Errorf("failed to create %s REST client: %w", group, err)
	}
	return client, nil
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
