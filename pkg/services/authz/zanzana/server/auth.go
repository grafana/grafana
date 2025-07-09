package server

import (
	"context"
	"github.com/grafana/grafana/pkg/setting"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	claims "github.com/grafana/authlib/types"
)

func authorize(ctx context.Context, namespace string, ss setting.ZanzanaServerSettings) error {
	if ss.AllowInsecure {
		return nil
	}
	c, ok := claims.AuthInfoFrom(ctx)
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
