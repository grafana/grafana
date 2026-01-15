package tempo

import (
	"context"
	"encoding/base64"
	"fmt"
	"net"
	"net/url"
	"strings"
	"sync"
	"time"

	"google.golang.org/grpc/metadata"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/tempo/pkg/tempopb"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"

	"github.com/grafana/grafana/pkg/infra/tracing"
)

var (
	logger = backend.NewLoggerWith("logger", "tsdb.tempo")

	// gRPC client metrics - initialized lazily
	grpcRequestsTotal *prometheus.CounterVec
	grpcRequestDuration *prometheus.HistogramVec
	grpcInFlightRequests *prometheus.GaugeVec

	metricsOnce sync.Once
)

// initGRPCMetrics initializes the gRPC client metrics
func initGRPCMetrics() {
	metricsOnce.Do(func() {
		grpcRequestsTotal = promauto.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: "grafana",
				Subsystem: "tempo_grpc",
				Name:      "requests_total",
				Help:      "Total number of gRPC requests to Tempo",
			},
			[]string{"method", "status"},
		)

		grpcRequestDuration = promauto.NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: "grafana",
				Subsystem: "tempo_grpc", 
				Name:      "request_duration_seconds",
				Help:      "Duration of gRPC requests to Tempo",
				Buckets:   prometheus.DefBuckets,
			},
			[]string{"method", "status"},
		)

		grpcInFlightRequests = promauto.NewGaugeVec(
			prometheus.GaugeOpts{
				Namespace: "grafana",
				Subsystem: "tempo_grpc",
				Name:      "in_flight_requests",
				Help:      "Number of in-flight gRPC requests to Tempo",
			},
			[]string{"method"},
		)
	})
}

// newGrpcClient creates a new gRPC client to connect to a streaming query service.
// This uses the default google.golang.org/grpc library. One caveat to that is that it does not allow passing the
// default httpClient to the gRPC client. This means that we cannot use the same middleware that we use for
// standard HTTP requests.
// Using other library like connect-go isn't possible right now because Tempo uses non-standard proto compiler which
// makes generating different client difficult. See https://github.com/grafana/grafana/pull/81683
func newGrpcClient(ctx context.Context, settings backend.DataSourceInstanceSettings, opts httpclient.Options) (tempopb.StreamingQuerierClient, error) {
	parsedUrl, err := url.Parse(settings.URL)
	if err != nil {
		logger.Error("Error parsing URL for gRPC client", "error", err, "URL", settings.URL, "function", logEntrypoint())
		return nil, err
	}

	// Make sure we have some default port if none is set. This is required for gRPC to work.
	onlyHost := parsedUrl.Host
	if !strings.Contains(onlyHost, ":") {
		if parsedUrl.Scheme == "http" {
			onlyHost += ":80"
		} else {
			onlyHost += ":443"
		}
	}

	dialOpts, err := getDialOpts(ctx, settings, opts)
	if err != nil {
		return nil, fmt.Errorf("error getting dial options: %w", err)
	}

	// grpc.Dial() is deprecated in favor of grpc.NewClient(), but grpc.NewClient() changed the default resolver to dns from passthrough.
	// This is a problem because the getDialOpts() function appends a custom dialer to the dial options to support Grafana Cloud PDC.
	//
	// See the following quote from the grpc package documentation:
	//     One subtle difference between NewClient and Dial and DialContext is that the
	//     former uses "dns" as the default name resolver, while the latter use
	//     "passthrough" for backward compatibility.  This distinction should not matter
	//     to most users, but could matter to legacy users that specify a custom dialer
	//     and expect it to receive the target string directly.
	// https://github.com/grpc/grpc-go/blob/fa274d77904729c2893111ac292048d56dcf0bb1/clientconn.go#L209
	//
	// Unfortunately, the passthrough resolver isn't exported by the grpc package, so we can't use it.
	// The options are to continue using grpc.Dial() or implement a custom resolver.
	// Since the go-grpc package maintainers intend to continue supporting grpc.Dial() through the 1.x series,
	// we'll continue using grpc.Dial() until we have a compelling reason or bandwidth to implement the custom resolver.
	// Reference: https://github.com/grpc/grpc-go/blob/f199062ef31ddda54152e1ca5e3d15fb63903dc3/clientconn.go#L204
	//
	// See this issue for more information: https://github.com/grpc/grpc-go/issues/7091
	// Ignore the lint check as this fails the build and for the reasons above.
	// nolint:staticcheck
	clientConn, err := grpc.Dial(onlyHost, dialOpts...)
	if err != nil {
		logger.Error("Error dialing gRPC client", "error", err, "URL", settings.URL, "function", logEntrypoint())
		return nil, err
	}

	logger.Debug("Instantiating new gRPC client")
	return tempopb.NewStreamingQuerierClient(clientConn), nil
}

// getDialOpts creates options and interceptors (middleware) this should roughly match what we do in
// http_client_provider.go for standard http requests.
func getDialOpts(ctx context.Context, settings backend.DataSourceInstanceSettings, opts httpclient.Options) ([]grpc.DialOption, error) {
	// TODO: Still missing some middleware compared to HTTP client:
	// - OAuth token forwarding (OAuthTokenMiddleware equivalent - requires integration with oauthtoken.OAuthTokenService)
	// - Response limits (not applicable to gRPC streaming)
	// - Redirect handling (not applicable to gRPC)
	// - Complete contextual middleware support
	//
	// Implemented so far:
	// ✓ Basic tracing (logging-based)
	// ✓ Basic metrics (logging-based)
	// ✓ Custom headers forwarding
	// ✓ User agent handling (automatic)

	var dialOps []grpc.DialOption

	dialOps = append(dialOps, grpc.WithDefaultCallOptions(grpc.MaxCallRecvMsgSize(100*1024*1024)))
  dialOps = append(dialOps, grpc.WithChainStreamInterceptor(
		MetricsStreamInterceptor(),
		TracingStreamInterceptor(),
		CustomHeadersStreamInterceptor(opts),
		UserAgentStreamInterceptor(),
	))
	if settings.BasicAuthEnabled {
		// If basic authentication is enabled, it uses TLS transport credentials and sets the basic authentication header for each RPC call.
		tls, err := httpclient.GetTLSConfig(opts)
		if err != nil {
			return nil, fmt.Errorf("failure in configuring tls for grpc: %w", err)
		}

		dialOps = append(dialOps, grpc.WithTransportCredentials(credentials.NewTLS(tls)))
		dialOps = append(dialOps, grpc.WithPerRPCCredentials(&basicAuth{
			Header: basicHeaderForAuth(opts.BasicAuth.User, opts.BasicAuth.Password),
		}))
	} else {
		// Otherwise, it uses insecure credentials.
		dialOps = append(dialOps, grpc.WithTransportCredentials(insecure.NewCredentials()))
	}

	// The following code is required to make gRPC work with Grafana Cloud PDC
	// (https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/)
	proxyClient, err := settings.ProxyClient(ctx)
	if err != nil {
		return nil, fmt.Errorf("proxy client cannot be retrieved, it is not possible to check if secure socks proxy is enabled: %w", err)
	}
	if proxyClient.SecureSocksProxyEnabled() { // secure socks proxy is behind a feature flag
		dialer, err := proxyClient.NewSecureSocksProxyContextDialer()
		if err != nil {
			return nil, fmt.Errorf("failure in creating dialer: %w", err)
		}
		logger.Debug("gRPC dialer instantiated. Appending gRPC dialer to dial options")
		dialOps = append(dialOps, grpc.WithContextDialer(func(ctx context.Context, host string) (net.Conn, error) {
			logger.Debug("Dialing secure socks proxy", "host", host)
			conn, err := dialer.Dial("tcp", host)
			if err != nil {
				return nil, fmt.Errorf("not possible to dial secure socks proxy: %w", err)
			}
			select {
			case <-ctx.Done():
				logger.Debug("Context canceled")
				// We return `conn` anyway since we need to better test how context cancellation works
				return conn, fmt.Errorf("context canceled: %w", err)
			default:
				return conn, nil
			}
		}))
	}

	logger.Debug("Returning dial options")
	return dialOps, nil
}

// CustomHeadersStreamInterceptor adds custom headers to the outgoing context for each RPC call. Should work similar
// to the CustomHeadersMiddleware in the HTTP client provider.
func CustomHeadersStreamInterceptor(httpOpts httpclient.Options) grpc.StreamClientInterceptor {
	return func(ctx context.Context, desc *grpc.StreamDesc, cc *grpc.ClientConn, method string, streamer grpc.Streamer, opts ...grpc.CallOption) (grpc.ClientStream, error) {
		if len(httpOpts.Header) != 0 {
			for key, value := range httpOpts.Header {
				for _, v := range value {
					ctx = metadata.AppendToOutgoingContext(ctx, key, v)
				}
			}
		}

		return streamer(ctx, desc, cc, method, opts...)
	}
}

// UserAgentStreamInterceptor adds user agent to the outgoing context for each RPC call.
func UserAgentStreamInterceptor() grpc.StreamClientInterceptor {
	return func(ctx context.Context, desc *grpc.StreamDesc, cc *grpc.ClientConn, method string, streamer grpc.Streamer, opts ...grpc.CallOption) (grpc.ClientStream, error) {
		// Get user agent from context and add it to the outgoing metadata
		if userAgent := backend.UserAgentFromContext(ctx); userAgent != nil {
			ctx = metadata.AppendToOutgoingContext(ctx, "User-Agent", userAgent.String())
		}

		return streamer(ctx, desc, cc, method, opts...)
	}
}

// TracingStreamInterceptor adds OpenTelemetry tracing support for gRPC streaming calls.
// This creates proper OpenTelemetry spans with attributes and error handling.
func TracingStreamInterceptor() grpc.StreamClientInterceptor {
	return func(ctx context.Context, desc *grpc.StreamDesc, cc *grpc.ClientConn, method string, streamer grpc.Streamer, opts ...grpc.CallOption) (grpc.ClientStream, error) {
		// Start an OpenTelemetry span for the gRPC call
		ctx, span := tracing.Start(ctx, "tempo.grpc.stream", 
			attribute.String("rpc.method", method),
			attribute.String("rpc.service", "tempo"),
			attribute.String("rpc.system", "grpc"),
			attribute.String("stream.name", desc.StreamName),
			attribute.Bool("stream.client", true),
		)
		defer span.End()

		logger.Debug("gRPC streaming call", "method", method, "stream_name", desc.StreamName)

		stream, err := streamer(ctx, desc, cc, method, opts...)
		if err != nil {
			// Record the error in the span
			span.RecordError(err)
			span.SetStatus(codes.Error, err.Error())
			span.SetAttributes(attribute.String("rpc.grpc.status", "error"))
			logger.Error("gRPC streaming call failed", "method", method, "error", err)
		} else {
			span.SetStatus(codes.Ok, "success")
			span.SetAttributes(attribute.String("rpc.grpc.status", "ok"))
		}

		return stream, err
	}
}

// MetricsStreamInterceptor adds Prometheus metrics collection for gRPC streaming calls.
// This provides similar functionality to the DataSourceMetricsMiddleware for HTTP clients.
func MetricsStreamInterceptor() grpc.StreamClientInterceptor {
	return func(ctx context.Context, desc *grpc.StreamDesc, cc *grpc.ClientConn, method string, streamer grpc.Streamer, opts ...grpc.CallOption) (grpc.ClientStream, error) {
		// Initialize metrics lazily
		initGRPCMetrics()

		startTime := time.Now()
		
		// Track in-flight requests
		grpcInFlightRequests.WithLabelValues(method).Inc()
		defer grpcInFlightRequests.WithLabelValues(method).Dec()

		stream, err := streamer(ctx, desc, cc, method, opts...)

		// Calculate metrics
		duration := time.Since(startTime)
		status := "success"
		if err != nil {
			status = "error"
		}

		// Record metrics
		grpcRequestsTotal.WithLabelValues(method, status).Inc()
		grpcRequestDuration.WithLabelValues(method, status).Observe(duration.Seconds())

		logger.Debug("gRPC streaming call completed",
			"method", method,
			"duration_ms", duration.Milliseconds(),
			"status", status)

		return stream, err
	}
}

type basicAuth struct {
	Header string
}

func (c *basicAuth) GetRequestMetadata(context.Context, ...string) (map[string]string, error) {
	return map[string]string{
		"Authorization": c.Header,
	}, nil
}

func (c *basicAuth) RequireTransportSecurity() bool {
	return true
}

func basicHeaderForAuth(username, password string) string {
	return fmt.Sprintf("Basic %s", base64.StdEncoding.EncodeToString([]byte(fmt.Sprintf("%s:%s", username, password))))
}
