package contracts

import (
	"context"
	"errors"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
)

var (
	ErrDecryptNotFound      = errors.New("not found")
	ErrDecryptNotAuthorized = errors.New("not authorized")
	ErrDecryptFailed        = errors.New("decryption failed")
)

// DecryptStorage is the interface for wiring and dependency injection.
type DecryptStorage interface {
	Decrypt(ctx context.Context, namespace xkube.Namespace, name string) (secretv0alpha1.ExposedSecureValue, error)
}

// DecryptAuthorizer is the interface for authorizing decryption requests.
type DecryptAuthorizer interface {
	Authorize(ctx context.Context, secureValueDecrypters []string) (identity string, allowed bool)
}

// TEMPORARY: Needed to pass it with wire.
type DecryptAllowList map[string]struct{}

// DecryptResult is the (union) result of a decryption operation.
// It contains the decrypted `value` when the decryption succeeds, and the `err` when it fails.
// It is not possible to construct a `DecryptResult` where both `value` and `err` are set from another package.
type DecryptResult struct {
	value *secretv0alpha1.ExposedSecureValue
	err   error
}

func (d DecryptResult) Error() error {
	return d.err
}

func (d DecryptResult) Value() *secretv0alpha1.ExposedSecureValue {
	return d.value
}

func NewDecryptResultErr(err error) DecryptResult {
	return DecryptResult{err: err}
}

func NewDecryptResultValue(value *secretv0alpha1.ExposedSecureValue) DecryptResult {
	return DecryptResult{value: value}
}

// DecryptService is the inferface for the decrypt service.
type DecryptService interface {
	Decrypt(ctx context.Context, namespace string, names ...string) (map[string]DecryptResult, error)
}
