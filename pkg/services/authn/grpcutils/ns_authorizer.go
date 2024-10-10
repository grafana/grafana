package grpcutils

import (
	authzlib "github.com/grafana/authlib/authz"
	"github.com/grafana/authlib/claims"

	"github.com/grafana/grafana/pkg/setting"
)

func NewNamespaceAuthorizer(cfg *setting.Cfg) authzlib.AuthorizeFunc {
	var na authzlib.NamespaceAccessChecker

	if cfg.StackID != "" {
		na = authzlib.NewNamespaceAccessChecker(
			claims.CloudNamespaceFormatter,
			authzlib.WithIDTokenNamespaceAccessCheckerOption(true),
		)
	} else {
		na = authzlib.NewNamespaceAccessChecker(
			claims.OrgNamespaceFormatter,
			authzlib.WithDisableAccessTokenNamespaceAccessCheckerOption(),
			authzlib.WithIDTokenNamespaceAccessCheckerOption(true),
		)
	}

	return authzlib.NamespaceAuthorizationFunc(
		na,
		authzlib.MetadataNamespaceExtractor(authzlib.DefaultNamespaceMetadataKey),
	)
}
