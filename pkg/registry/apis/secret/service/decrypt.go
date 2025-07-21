package service

import (
	"context"

	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
)

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

// DecryptService is the inferface for the decrypt service.
type DecryptService interface {
	Decrypt(ctx context.Context, namespace string, names ...string) (map[string]DecryptResult, error)
}
