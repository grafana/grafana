// Package client constructs an authenticated shared gRPC connection to the proxy.
package client

import (
	"errors"
	"fmt"

	"github.com/grafana/authlib/authn"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
)

const audience = "single-tenant-db-proxy"

// NewConn creates a lazy connection. The caller owns Close and must provide service-authenticated transport.
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
	conn, err := grpc.NewClient(target, grpc.WithTransportCredentials(transport), grpc.WithStreamInterceptor(interceptor.StreamClientInterceptor), grpc.WithDisableRetry())
	if err != nil {
		return nil, fmt.Errorf("create proxy gRPC connection: %w", err)
	}
	return conn, nil
}
