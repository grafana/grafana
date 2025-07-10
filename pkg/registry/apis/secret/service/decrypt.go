package service

import (
	"context"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

// DecryptResult is the (union) result of a decryption operation.
// It contains the decrypted `value` when the decryption succeeds, and the `err` when it fails.
// It is not possible to construct a `DecryptResult` where both `value` and `err` are set from another package.
type DecryptResult struct {
	value *common.RawSecureValue
	err   error
}

func (d DecryptResult) Error() error {
	return d.err
}

func (d DecryptResult) Value() *common.RawSecureValue {
	return d.value
}

func NewDecryptResultErr(err error) DecryptResult {
	return DecryptResult{err: err}
}

func NewDecryptResultValue(value *common.RawSecureValue) DecryptResult {
	return DecryptResult{value: value}
}

// DecryptService is the inferface for the decrypt service.
type DecryptService interface {
	Decrypt(ctx context.Context, namespace string, names ...string) (map[string]DecryptResult, error)
}
