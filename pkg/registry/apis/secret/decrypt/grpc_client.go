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
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"

	decryptv1beta1 "github.com/grafana/grafana/apps/secret/decrypt/v1beta1"
	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
)

type GRPCDecryptClient struct {
	conn   *grpc.ClientConn
	client decryptv1beta1.SecureValueDecrypterClient
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

func NewGRPCDecryptClient(tokenExchanger authnlib.TokenExchanger, tracer trace.Tracer, namespace, address string) (*GRPCDecryptClient, error) {
	return NewGRPCDecryptClientWithTLS(tokenExchanger, tracer, namespace, address, TLSConfig{})
}

func NewGRPCDecryptClientWithTLS(
	tokenExchanger authnlib.TokenExchanger,
	tracer trace.Tracer,
	namespace string,
	address string,
	tlsConfig TLSConfig,
) (*GRPCDecryptClient, error) {
	var opts []grpc.DialOption
	if tlsConfig.UseTLS {
		creds, err := createTLSCredentials(tlsConfig)
		if err != nil {
			return nil, fmt.Errorf("failed to setup TLS: %w", err)
		}

		opts = append(opts, grpc.WithTransportCredentials(creds))
	} else {
		opts = append(opts, grpc.WithTransportCredentials(insecure.NewCredentials()))
	}

	conn, err := grpc.NewClient(address, opts...)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to grpc decrypt server at %s: %w", address, err)
	}

	tokenExchangerInterceptor := authnlib.NewGrpcClientInterceptor(
		tokenExchanger,
		authnlib.WithClientInterceptorTracer(tracer),
		authnlib.WithClientInterceptorNamespace(namespace),
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

func (g *GRPCDecryptClient) Decrypt(ctx context.Context, serviceName string, namespace string, names []string) (map[string]contracts.DecryptResult, error) {
	req := &decryptv1beta1.SecureValueDecryptRequest{
		Namespace: namespace,
		Names:     names,
	}

	// Decryption will still use the service identity from the auth token,
	// but we also pass the service identity from the request metadata for auditing purposes.
	md := metadata.New(map[string]string{
		contracts.HeaderGrafanaServiceIdentityName: serviceName,
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
