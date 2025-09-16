package decrypt

import (
	"context"

	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
)

// NoopAlwaysAllowedAuthorizer is a no-op implementation of the DecryptAuthorizer which always returns `allowed=true`.
type NoopAlwaysAllowedAuthorizer struct{}

var _ contracts.DecryptAuthorizer = &NoopAlwaysAllowedAuthorizer{}

func (a *NoopAlwaysAllowedAuthorizer) Authorize(context.Context, xkube.Namespace, string, []string) (string, bool) {
	return "", true
}
