package decrypt

import (
	"context"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
)

// NoopAlwaysAllowedAuthorizer is a no-op implementation of the DecryptAuthorizer which always returns `allowed=true`.
type NoopAlwaysAllowedAuthorizer struct{}

var _ contracts.DecryptAuthorizer = &NoopAlwaysAllowedAuthorizer{}

func (a *NoopAlwaysAllowedAuthorizer) Authorize(context.Context, xkube.Namespace, string, []string, []metav1.OwnerReference) (string, bool, string) {
	return "", true, ""
}
