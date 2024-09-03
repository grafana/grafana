package grpcutils

import (
	authzlib "github.com/grafana/authlib/authz"
	"github.com/grafana/authlib/claims"

	"github.com/grafana/grafana/pkg/setting"
)

func NewNamespaceAccessChecker(cfg *setting.Cfg) authzlib.NamespaceAccessChecker {
	if cfg.StackID != "" {
		return authzlib.NewNamespaceAccessChecker(
			claims.CloudNamespaceFormatter,
			authzlib.WithIDTokenNamespaceAccessCheckerOption(true),
		)
	}

	return authzlib.NewNamespaceAccessChecker(
		claims.OrgNamespaceFormatter,
		authzlib.WithDisableAccessTokenNamespaceAccessCheckerOption(),
		authzlib.WithIDTokenNamespaceAccessCheckerOption(true),
	)
}
