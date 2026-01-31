package resource

import (
	"crypto/tls"
	"net/http"

	"github.com/fullstorydev/grpchan"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc"

	authnlib "github.com/grafana/authlib/authn"
)

// RemoteClientConfig holds configuration for creating a remote client that connects
// to a resource server over the network. This configuration includes authentication
// tokens and security settings.
type RemoteClientConfig struct {
	// Token is the static service token used for authentication
	Token string
	// TokenExchangeURL is the URL to exchange tokens for access
	TokenExchangeURL string
	// Audiences specifies the intended recipients of the token
	Audiences []string
	// Namespace is the token namespace (use "*" for wildcard)
	Namespace string
	// AllowInsecure enables insecure TLS connections (for development only)
	AllowInsecure bool
}

// NewRemoteSearchClient creates a SearchClient for remote connections with authentication.
//
// Use this when:
//   - Connecting to a remote search/index service
//   - You only need search/index operations (not storage)
func NewRemoteSearchClient(tracer trace.Tracer, searchConn grpc.ClientConnInterface, cfg RemoteClientConfig) (SearchClient, error) {
	remoteSearchClient, err := newRemoteClient(tracer, searchConn, cfg)
	if err != nil {
		return nil, err
	}
	return newSearchClient(remoteSearchClient), nil
}

// NewRemoteStorageClient creates a StorageClient for remote connections with authentication.
//
// Use this when:
//   - Connecting to a remote storage service
//   - You only need storage operations (not search/index)
func NewRemoteStorageClient(tracer trace.Tracer, storageConn grpc.ClientConnInterface, cfg RemoteClientConfig) (StorageClient, error) {
	remoteStorageClient, err := newRemoteClient(tracer, storageConn, cfg)
	if err != nil {
		return nil, err
	}
	return newStorageClient(remoteStorageClient), nil
}

func newRemoteResourceClient(tracer trace.Tracer, conn grpc.ClientConnInterface, indexConn grpc.ClientConnInterface, cfg RemoteClientConfig) (*Client, error) {
	clientInt, err := newRemoteClientInterceptor(tracer, cfg)
	if err != nil {
		return nil, err
	}
	cc := grpchan.InterceptClientConn(conn, clientInt.UnaryClientInterceptor, clientInt.StreamClientInterceptor)
	cci := grpchan.InterceptClientConn(indexConn, clientInt.UnaryClientInterceptor, clientInt.StreamClientInterceptor)
	return newResourceClient(cc, cci), nil
}

func newRemoteClient(tracer trace.Tracer, conn grpc.ClientConnInterface, cfg RemoteClientConfig) (grpc.ClientConnInterface, error) {
	clientInt, err := newRemoteClientInterceptor(tracer, cfg)
	if err != nil {
		return nil, err
	}
	return grpchan.InterceptClientConn(conn, clientInt.UnaryClientInterceptor, clientInt.StreamClientInterceptor), nil
}

func newRemoteClientInterceptor(tracer trace.Tracer, cfg RemoteClientConfig) (*authnlib.GrpcClientInterceptor, error) {
	exchangeOpts := []authnlib.ExchangeClientOpts{}

	if cfg.AllowInsecure {
		exchangeOpts = append(exchangeOpts, authnlib.WithHTTPClient(&http.Client{Transport: &http.Transport{TLSClientConfig: &tls.Config{InsecureSkipVerify: true}}}))
	}

	tc, err := authnlib.NewTokenExchangeClient(authnlib.TokenExchangeConfig{
		Token:            cfg.Token,
		TokenExchangeURL: cfg.TokenExchangeURL,
	}, exchangeOpts...)
	if err != nil {
		return nil, err
	}
	return authnlib.NewGrpcClientInterceptor(
		tc,
		authnlib.WithClientInterceptorTracer(tracer),
		authnlib.WithClientInterceptorNamespace(cfg.Namespace),
		authnlib.WithClientInterceptorAudience(cfg.Audiences),
		authnlib.WithClientInterceptorIDTokenExtractor(idTokenExtractor),
	), nil
}
