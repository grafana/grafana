package contracts

import (
	"context"
	"errors"

	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
)

// HeaderGrafanaServiceIdentityName is used to pass the service identity in the gRPC request metadata.
const HeaderGrafanaServiceIdentityName = "X-Grafana-Service-Identity-Name"

var (
	ErrDecryptNotFound      = errors.New("not found")
	ErrDecryptNotAuthorized = errors.New("not authorized")
	ErrDecryptFailed        = errors.New("decryption failed")
)

// DecryptStorage is the interface for wiring and dependency injection.
type DecryptStorage interface {
	Decrypt(ctx context.Context, namespace xkube.Namespace, name string) (secretv1beta1.ExposedSecureValue, error)
}

// DecryptAuthorizer is the interface for authorizing decryption requests.
type DecryptAuthorizer interface {
	Authorize(ctx context.Context, namespace xkube.Namespace, secureValueName string, secureValueDecrypters []string) (identity string, allowed bool)
}
