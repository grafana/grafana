package decrypt

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"maps"
	"os"
	"slices"

	"github.com/fullstorydev/grpchan"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"

	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	decryptv1beta1 "github.com/grafana/grafana/apps/secret/decrypt/v1beta1"
	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/apps/secret/pkg/decrypt"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
)

type GRPCDecryptClient struct {
	conn           *grpc.ClientConn
	tracer         trace.Tracer
	tokenExchanger authnlib.TokenExchanger
}

var _ decrypt.DecryptService = &GRPCDecryptClient{}

type TLSConfig struct {
	UseTLS             bool
	CAFile             string
	ServerName         string
	InsecureSkipVerify bool
}

func NewGRPCDecryptClient(tokenExchanger authnlib.TokenExchanger, tracer trace.Tracer, address string) (*GRPCDecryptClient, error) {
	return NewGRPCDecryptClientWithTLS(tokenExchanger, tracer, address, TLSConfig{})
}

func NewGRPCDecryptClientWithTLS(
	tokenExchanger authnlib.TokenExchanger,
	tracer trace.Tracer,
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

	return &GRPCDecryptClient{
		conn:           conn,
		tracer:         tracer,
		tokenExchanger: tokenExchanger,
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

	if config.ServerName != "" {
		tlsConfig.ServerName = config.ServerName
	}

	if config.InsecureSkipVerify {
		tlsConfig.InsecureSkipVerify = true
	}

	return credentials.NewTLS(tlsConfig), nil
}

// Decrypt a set of secure value names in a given namespace for a specific service name.
func (g *GRPCDecryptClient) Decrypt(ctx context.Context, serviceName string, namespace string, names ...string) (map[string]decrypt.DecryptResult, error) {
	_, err := types.ParseNamespace(namespace)
	if err != nil {
		return nil, err
	}

	unique := make(map[string]bool, len(names))
	for _, v := range names {
		if v != "" {
			unique[v] = true
		}
	}
	if len(unique) < 1 {
		return map[string]decrypt.DecryptResult{}, nil
	}

	tokenExchangerInterceptor := authnlib.NewGrpcClientInterceptor(
		g.tokenExchanger,
		authnlib.WithClientInterceptorTracer(g.tracer),
		authnlib.WithClientInterceptorNamespace(namespace),
		authnlib.WithClientInterceptorAudience([]string{secretv1beta1.APIGroup}),
	)

	clientConn := grpchan.InterceptClientConn(
		g.conn,
		tokenExchangerInterceptor.UnaryClientInterceptor,
		tokenExchangerInterceptor.StreamClientInterceptor,
	)

	client := decryptv1beta1.NewSecureValueDecrypterClient(clientConn)

	req := &decryptv1beta1.SecureValueDecryptRequest{
		Namespace: namespace,
		Names:     slices.Collect(maps.Keys(unique)),
	}

	// Decryption will still use the service identity from the auth token,
	// but we also pass the service identity from the request metadata for auditing purposes.
	md := metadata.New(map[string]string{
		contracts.HeaderGrafanaServiceIdentityName: serviceName,
	})
	ctx = metadata.NewOutgoingContext(ctx, md)

	resp, err := client.DecryptSecureValues(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("grpc decrypt failed: %w", err)
	}

	results := make(map[string]decrypt.DecryptResult, len(resp.GetDecryptedValues()))

	for name, result := range resp.GetDecryptedValues() {
		if result.GetErrorMessage() != "" {
			results[name] = decrypt.NewDecryptResultErr(errors.New(result.GetErrorMessage()))
		} else {
			exposedSecureValue := secretv1beta1.NewExposedSecureValue(result.GetValue())
			results[name] = decrypt.NewDecryptResultValue(&exposedSecureValue)
		}
	}

	return results, nil
}
