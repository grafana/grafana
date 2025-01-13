package server

import (
	"context"

	"github.com/grafana/authlib/claims"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func authorize(ctx context.Context, namespace string) error {
	c, ok := claims.From(ctx)
	if !ok {
		return status.Errorf(codes.Unauthenticated, "unauthenticated")
	}
	if c.GetNamespace() == "" || namespace == "" {
		return status.Errorf(codes.Unauthenticated, "unauthenticated")
	}
	if !claims.NamespaceMatches(c.GetNamespace(), namespace) {
		return status.Errorf(codes.PermissionDenied, "namespace does not match")
	}
	return nil
}
