package decrypt

import (
	"context"

	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
)

// NoopAlwaysAllowedAuthorizer is a no-op implementation of the DecryptAuthorizer which always returns `allowed=true`.
type NoopAlwaysAllowedAuthorizer struct{}

var _ contracts.DecryptAuthorizer = &NoopAlwaysAllowedAuthorizer{}

func (a *NoopAlwaysAllowedAuthorizer) Authorize(ctx context.Context, secureValueName string, secureValueDecrypters []string) (identity string, allowed bool) {
	return "", true
}
