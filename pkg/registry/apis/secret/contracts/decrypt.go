package contracts

import (
	"context"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
)

// DecryptStorage is the interface for wiring and dependency injection.
type DecryptStorage interface {
	Decrypt(ctx context.Context, nn xkube.NameNamespace) (secretv0alpha1.ExposedSecureValue, error)
}
