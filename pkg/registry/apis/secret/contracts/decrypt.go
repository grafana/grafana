package contracts

import (
	"context"
	"errors"

	secretv1beta1 "github.com/grafana/grafana/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
)

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

// TEMPORARY: Needed to pass it with wire.
type DecryptAllowList map[string]struct{}
