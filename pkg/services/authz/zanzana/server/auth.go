package server

import (
	"context"

	claims "github.com/grafana/authlib/types"
	"golang.org/x/exp/slices"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/setting"
)

func authorize(ctx context.Context, namespace string, cfg setting.ZanzanaServerSettings) error {
	logger := log.New("zanzana.server.auth")
	if cfg.AllowInsecure {
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
