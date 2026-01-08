package server

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/setting"
	"golang.org/x/exp/slices"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	claims "github.com/grafana/authlib/types"
)

func authorize(ctx context.Context, namespace string, ss setting.ZanzanaServerSettings) error {
	logger := log.New("zanzana.server.auth")
	if ss.AllowInsecure {
		logger.Debug("AllowInsecure=true; skipping authorization check")
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
		return status.Errorf(codes.PermissionDenied, "token namespace %s does not match request namespace", c.GetNamespace())
	}
	return nil
}

func authorizeWrite(ctx context.Context, namespace string, ss setting.ZanzanaServerSettings) error {
	if err := authorize(ctx, namespace, ss); err != nil {
		return err
	}

	c, ok := claims.AuthInfoFrom(ctx)
	if !ok {
		return status.Errorf(codes.Unauthenticated, "unauthenticated")
	}

	if !slices.Contains(c.GetTokenPermissions(), zanzana.TokenPermissionUpdate) {
		return status.Errorf(codes.PermissionDenied, "missing token permission %s", zanzana.TokenPermissionUpdate)
	}

	return nil
}
