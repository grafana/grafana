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
	Authorize(ctx context.Context, secureValueName string, secureValueDecrypters []string) (identity string, allowed bool)
}

// DecryptService is the interface for the decrypt service.
type DecryptService interface {
	Decrypt(ctx context.Context, serviceName string, namespace string, names ...string) (map[string]DecryptResult, error)
	Close() error
}

// DecryptResult is the (union) result of a decryption operation.
// It contains the decrypted `value` when the decryption succeeds, and the `err` when it fails.
// It is not possible to construct a `DecryptResult` where both `value` and `err` are set from another package.
type DecryptResult struct {
	value *secretv1beta1.ExposedSecureValue
	err   error
}

func (d DecryptResult) Error() error {
	return d.err
}

func (d DecryptResult) Value() *secretv1beta1.ExposedSecureValue {
	return d.value
}

func NewDecryptResultErr(err error) DecryptResult {
	return DecryptResult{err: err}
}

func NewDecryptResultValue(value *secretv1beta1.ExposedSecureValue) DecryptResult {
	return DecryptResult{value: value}
}
