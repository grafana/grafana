// Package client constructs an authenticated shared gRPC connection to the proxy.
package client

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/authlib/authn"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
)

const audience = "single-tenant-db-proxy"

// ErrNotSent identifies local authentication failures before a unary call reaches the transport.
var ErrNotSent = errors.New("single-tenant database proxy: request not sent")

// NewConn creates a lazy connection. The caller supplies transport credentials for the endpoint and owns Close.
func NewConn(target string, transport credentials.TransportCredentials, exchanger authn.TokenExchanger) (*grpc.ClientConn, error) {
	if target == "" {
		return nil, errors.New("proxy target required")
	}
	if transport == nil {
		return nil, errors.New("proxy transport credentials required")
	}
	if exchanger == nil {
		return nil, errors.New("proxy token exchanger required")
	}
	interceptor := authn.NewGrpcClientInterceptor(exchanger, authn.WithClientInterceptorAudience([]string{audience}), authn.WithClientInterceptorNamespace("*"))
	conn, err := grpc.NewClient(target, grpc.WithTransportCredentials(transport), grpc.WithStreamInterceptor(interceptor.StreamClientInterceptor), grpc.WithUnaryInterceptor(authenticateUnary(interceptor)), grpc.WithDisableRetry())
	if err != nil {
		return nil, fmt.Errorf("create proxy gRPC connection: %w", err)
	}
	return conn, nil
}

func authenticateUnary(auth *authn.GrpcClientInterceptor) grpc.UnaryClientInterceptor {
	return func(ctx context.Context, method string, req, reply any, conn *grpc.ClientConn, invoke grpc.UnaryInvoker, opts ...grpc.CallOption) error {
		invoked := false
		err := auth.UnaryClientInterceptor(ctx, method, req, reply, conn, func(ctx context.Context, method string, req, reply any, conn *grpc.ClientConn, opts ...grpc.CallOption) error {
			invoked = true
			return invoke(ctx, method, req, reply, conn, opts...)
		}, opts...)
		if err != nil && !invoked {
			return fmt.Errorf("%w: %w", ErrNotSent, err)
		}
		return err
	}
}
