package secret

import (
	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
)

// DecryptService is a decrypt client for secure value secrets.
type DecryptService = contracts.DecryptService

var (
	ErrDecryptNotFound      = contracts.ErrDecryptNotFound
	ErrDecryptNotAuthorized = contracts.ErrDecryptNotAuthorized
	ErrDecryptFailed        = contracts.ErrDecryptFailed
)

type DecryptResult = contracts.DecryptResult

func NewDecryptResultErr(err error) DecryptResult {
	return contracts.NewDecryptResultErr(err)
}

func NewDecryptResultValue(value *secretv1beta1.ExposedSecureValue) DecryptResult {
	return contracts.NewDecryptResultValue(value)
}
