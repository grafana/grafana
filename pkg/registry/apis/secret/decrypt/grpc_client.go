package decrypt

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"os"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/metadata"

	decryptv1beta1 "github.com/grafana/grafana/apps/secret/decrypt/v1beta1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/authn/clients"
)

type GRPCDecryptClient struct {
	conn   *grpc.ClientConn
	client decryptv1beta1.SecureValueDecrypterClient
}

type TLSConfig struct {
	UseTLS             bool
	CertFile           string
	KeyFile            string
	CAFile             string
	ServerName         string
	InsecureSkipVerify bool
}

func NewGRPCDecryptClient(address string, logger log.Logger) (*GRPCDecryptClient, error) {
	return NewGRPCDecryptClientWithTLS(address, logger, nil)
}

func NewGRPCDecryptClientWithTLS(address string, logger log.Logger, tlsConfig *TLSConfig) (*GRPCDecryptClient, error) {
	opts := []grpc.DialOption{}

	creds, err := createTLSCredentials(tlsConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to setup TLS: %w", err)
	}

	opts = append(opts, grpc.WithTransportCredentials(creds))

	conn, err := grpc.Dial(address, opts...)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to grpc decrypt server at %s: %w", address, err)
	}

	client := decryptv1beta1.NewSecureValueDecrypterClient(conn)

	return &GRPCDecryptClient{
		conn:   conn,
		client: client,
	}, nil
}

func createTLSCredentials(config *TLSConfig) (credentials.TransportCredentials, error) {
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

func (g *GRPCDecryptClient) GetConnection() *grpc.ClientConn {
	return g.conn
}

func (g *GRPCDecryptClient) DecryptSecureValues(ctx context.Context, namespace string, names []string, accessToken string) (map[string]*decryptv1beta1.Result, error) {
	req := &decryptv1beta1.SecureValueDecryptRequest{
		Namespace: namespace,
		Names:     names,
	}

	md := metadata.New(map[string]string{
		clients.ExtJWTAuthenticationHeaderName: accessToken,
	})
	ctx = metadata.NewOutgoingContext(ctx, md)

	resp, err := g.client.DecryptSecureValues(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("grpc decrypt failed: %w", err)
	}

	return resp.DecryptedValues, nil
}
