package router

import (
	"github.com/grafana/dskit/middleware"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

// pluginGRPCDialOptions returns the options for a connection to a plugin
// deployment. requestDuration must already be curried with the plugin ID.
func pluginGRPCDialOptions(requestDuration *prometheus.HistogramVec) []grpc.DialOption {
	return []grpc.DialOption{
		// Plugin deployments expose plaintext gRPC on the internal cluster network.
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithStatsHandler(otelgrpc.NewClientHandler()),
		grpc.WithChainUnaryInterceptor(middleware.UnaryClientInstrumentInterceptor(requestDuration, middleware.ReportGRPCStatusOption)),
		grpc.WithChainStreamInterceptor(middleware.StreamClientInstrumentInterceptor(requestDuration, middleware.ReportGRPCStatusOption)),
		// Spread calls over every address the host resolves to, rather than
		// pinning the first one.
		grpc.WithDefaultServiceConfig(`{"loadBalancingPolicy":"round_robin"}`),
		// Don't look up service config in DNS TXT records; the default above
		// still applies.
		grpc.WithDisableServiceConfig(),
	}
}
