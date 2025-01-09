package server

import (
	"context"

	"github.com/grafana/authlib/claims"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type ReqWithNamespace interface {
	GetNamespace() string
}

func authorize(ctx context.Context, r ReqWithNamespace) error {
	c, ok := claims.From(ctx)
	if !ok {
		return status.Errorf(codes.Unauthenticated, "unauthenticated")
	}
	if !claims.NamespaceMatches(c.GetNamespace(), r.GetNamespace()) {
		return status.Errorf(codes.PermissionDenied, "namespace does not match")
	}
	return nil
}
