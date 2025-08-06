package inline

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"os"

	"github.com/fullstorydev/grpchan"
	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"

	inlinev1beta1 "github.com/grafana/grafana/apps/secret/inline/v1beta1"
	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
)

type GRPCInlineClient struct {
	conn           *grpc.ClientConn
	tracer         trace.Tracer
	tokenExchanger authnlib.TokenExchanger
}

var _ contracts.InlineSecureValueSupport = &GRPCInlineClient{}

type TLSConfig struct {
	UseTLS             bool
	CertFile           string
	KeyFile            string
	CAFile             string
	ServerName         string
	InsecureSkipVerify bool
}

func NewGRPCInlineClient(tokenExchanger authnlib.TokenExchanger, tracer trace.Tracer, address string, tlsConfig TLSConfig) (*GRPCInlineClient, error) {
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
		return nil, fmt.Errorf("failed to connect to grpc server at %s: %w", address, err)
	}

	return &GRPCInlineClient{
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

// Close will close the underlying gRPC connection. After it is closed, the client cannot be used anymore.
func (g *GRPCInlineClient) Close() error {
	if g.conn != nil {
		return g.conn.Close()
	}
	return nil
}

func (g *GRPCInlineClient) CanReference(ctx context.Context, owner v0alpha1.ObjectReference, names ...string) error {
	client, err := g.getClient(owner.Namespace)
	if err != nil {
		return err
	}

	req := &inlinev1beta1.CanReferenceRequest{
		Owner: &inlinev1beta1.ObjectReference{
			ApiGroup:   owner.APIGroup,
			ApiVersion: owner.APIVersion,
			Kind:       owner.Kind,
			Namespace:  owner.Namespace,
			Name:       owner.Name,
		},
		Names: names,
	}

	_, err = client.CanReference(ctx, req)
	return err
}

func (g *GRPCInlineClient) CreateInline(ctx context.Context, owner v0alpha1.ObjectReference, value v0alpha1.RawSecureValue) (string, error) {
	client, err := g.getClient(owner.Namespace)
	if err != nil {
		return "", err
	}

	if value.IsZero() {
		return "", fmt.Errorf("empty value provided for CreateInline")
	}

	req := &inlinev1beta1.CreateInlineRequest{
		Owner: &inlinev1beta1.ObjectReference{
			ApiGroup:   owner.APIGroup,
			ApiVersion: owner.APIVersion,
			Kind:       owner.Kind,
			Namespace:  owner.Namespace,
			Name:       owner.Name,
		},
		Value: value.DangerouslyExposeAndConsumeValue(),
	}

	resp, err := client.CreateInline(ctx, req)
	if err != nil {
		return "", err
	}

	return resp.GetName(), nil
}

func (g *GRPCInlineClient) DeleteWhenOwnedByResource(ctx context.Context, owner v0alpha1.ObjectReference, name string) error {
	client, err := g.getClient(owner.Namespace)
	if err != nil {
		return err
	}

	req := &inlinev1beta1.DeleteWhenOwnedByResourceRequest{
		Owner: &inlinev1beta1.ObjectReference{
			ApiGroup:   owner.APIGroup,
			ApiVersion: owner.APIVersion,
			Kind:       owner.Kind,
			Namespace:  owner.Namespace,
			Name:       owner.Name,
		},
		Name: name,
	}

	_, err = client.DeleteWhenOwnedByResource(ctx, req)
	return err
}

func (g *GRPCInlineClient) getClient(namespace string) (inlinev1beta1.InlineSecureValueServiceClient, error) {
	_, err := types.ParseNamespace(namespace)
	if err != nil {
		return nil, err
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

	return inlinev1beta1.NewInlineSecureValueServiceClient(clientConn), nil
}
