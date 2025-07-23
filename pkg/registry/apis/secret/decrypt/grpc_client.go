package decrypt

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"os"

	"github.com/fullstorydev/grpchan"
	authnlib "github.com/grafana/authlib/authn"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/metadata"

	decryptv1beta1 "github.com/grafana/grafana/apps/secret/decrypt/v1beta1"
	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
)

type GRPCDecryptClient struct {
	serviceName string
	conn        *grpc.ClientConn
	client      decryptv1beta1.SecureValueDecrypterClient
}

var _ contracts.DecryptService = &GRPCDecryptClient{}

type TLSConfig struct {
	UseTLS             bool
	CertFile           string
	KeyFile            string
	CAFile             string
	ServerName         string
	InsecureSkipVerify bool
}

func NewGRPCDecryptClient(tokenExchanger authnlib.TokenExchanger, tracer trace.Tracer, address, serviceName string) (*GRPCDecryptClient, error) {
	return NewGRPCDecryptClientWithTLS(tokenExchanger, tracer, address, TLSConfig{}, serviceName)
}

func NewGRPCDecryptClientWithTLS(
	tokenExchanger authnlib.TokenExchanger,
	tracer trace.Tracer,
	address string,
	tlsConfig TLSConfig,
	serviceName string,
) (*GRPCDecryptClient, error) {
	creds, err := createTLSCredentials(tlsConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to setup TLS: %w", err)
	}

	conn, err := grpc.NewClient(address, grpc.WithTransportCredentials(creds))
	if err != nil {
		return nil, fmt.Errorf("failed to connect to grpc decrypt server at %s: %w", address, err)
	}

	// TODO: do we need to set authn.WithClientInterceptorNamespace?
	tokenExchangerInterceptor := authnlib.NewGrpcClientInterceptor(
		tokenExchanger,
		authnlib.WithClientInterceptorTracer(tracer),
		authnlib.WithClientInterceptorAudience([]string{secretv1beta1.APIGroup}),
	)

	clientConn := grpchan.InterceptClientConn(
		conn,
		tokenExchangerInterceptor.UnaryClientInterceptor,
		tokenExchangerInterceptor.StreamClientInterceptor,
	)

	return &GRPCDecryptClient{
		conn:   conn,
		client: decryptv1beta1.NewSecureValueDecrypterClient(clientConn),
	}, nil
}

func createTLSCredentials(config TLSConfig) (credentials.TransportCredentials, error) {
	tlsConfig := &tls.Config{}

	if config.CAFile != "" {
		caCert, err := os.ReadFile(config.CAFile)
		if err != nil {
			return nil, fmt.Errorf("failed to read CA: %w", err)
		}

		caCertPool := x509.NewCertPool()
		if !caCertPool.AppendCertsFromPEM(caCert) {
			return nil, fmt.Errorf("failed to append CA")
		}
		tlsConfig.RootCAs = caCertPool
	}

	if config.CertFile != "" && config.KeyFile != "" {
		cert, err := tls.LoadX509KeyPair(config.CertFile, config.KeyFile)
		if err != nil {
			return nil, fmt.Errorf("failed to load client certificate: %w", err)
		}
		tlsConfig.Certificates = []tls.Certificate{cert}
	}

	if config.ServerName != "" {
		tlsConfig.ServerName = config.ServerName
	}

	if config.InsecureSkipVerify {
		tlsConfig.InsecureSkipVerify = true
	}

	return credentials.NewTLS(tlsConfig), nil
}

func (g *GRPCDecryptClient) Close() error {
	if g.conn != nil {
		return g.conn.Close()
	}
	return nil
}

func (g *GRPCDecryptClient) Decrypt(ctx context.Context, namespace string, names ...string) (map[string]contracts.DecryptResult, error) {
	req := &decryptv1beta1.SecureValueDecryptRequest{
		Namespace: namespace,
		Names:     names,
	}

	// TODO: how to pass service name??
	md := metadata.New(map[string]string{
		"X-Grafana-Service-Name": g.serviceName,
	})
	ctx = metadata.NewOutgoingContext(ctx, md)

	resp, err := g.client.DecryptSecureValues(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("grpc decrypt failed: %w", err)
	}

	results := make(map[string]contracts.DecryptResult, len(resp.GetDecryptedValues()))

	for name, result := range resp.GetDecryptedValues() {
		if result.GetErrorMessage() != "" {
			results[name] = contracts.NewDecryptResultErr(errors.New(result.GetErrorMessage()))
		} else {
			exposedSecureValue := secretv1beta1.NewExposedSecureValue(result.GetValue())
			results[name] = contracts.NewDecryptResultValue(&exposedSecureValue)
		}
	}

	return results, nil
}
