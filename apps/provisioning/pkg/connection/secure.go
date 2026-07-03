package connection

import (
	"context"
	"errors"
	"fmt"
	"time"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/secret/pkg/decrypt"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

var (
	// ErrSecretNotFound indicates that a secure value is referenced by name but the
	// underlying secret could not be resolved to a value (deleted or otherwise
	// undecryptable). It is distinct from a transient decrypt-service failure, which
	// is returned unwrapped so callers keep retrying instead of regenerating.
	ErrSecretNotFound = errors.New("secure value could not be decrypted")

	// ErrTokenNotFound is ErrSecretNotFound scoped to the connection token, letting
	// the controller regenerate only when the token itself is the missing secret.
	ErrTokenNotFound = errors.New("token secure value could not be decrypted")
)

type secretTypeLabel string

const (
	secretTypePrivateKey   secretTypeLabel = "private_key"
	secretTypeClientSecret secretTypeLabel = "client_secret"
	secretTypeToken        secretTypeLabel = "token"
)

type Decrypter = func(c *provisioning.Connection) SecureValues

type SecureValues interface {
	PrivateKey(ctx context.Context) (common.RawSecureValue, error)
	ClientSecret(ctx context.Context) (common.RawSecureValue, error)
	Token(ctx context.Context) (common.RawSecureValue, error)
}

type secureValues struct {
	svc       decrypt.DecryptService
	metrics   *DecryptMetrics
	names     provisioning.ConnectionSecure
	namespace string
}

func (s *secureValues) get(ctx context.Context, sv common.InlineSecureValue, st secretTypeLabel) (_ common.RawSecureValue, err error) {
	if !sv.Create.IsZero() {
		return sv.Create, nil // If this was called before the value is actually saved
	}
	if sv.Name == "" {
		return "", nil
	}

	start := time.Now()
	defer func() {
		elapsed := time.Since(start).Seconds()
		if err != nil {
			s.metrics.recordError(st)
		} else {
			s.metrics.recordSuccess(st, elapsed)
		}
	}()

	results, err := s.svc.Decrypt(ctx, provisioning.GROUP, s.namespace, sv.Name)
	if err != nil {
		return "", fmt.Errorf("failed to call decrypt service: %w", err)
	}

	v, found := results[sv.Name]
	if !found {
		return "", fmt.Errorf("%w: %q not found", ErrSecretNotFound, sv.Name)
	}
	if err := v.Error(); err != nil {
		return "", fmt.Errorf("%w: %q: %w", ErrSecretNotFound, sv.Name, err)
	}

	return common.RawSecureValue(*v.Value()), nil
}

func (s *secureValues) PrivateKey(ctx context.Context) (common.RawSecureValue, error) {
	return s.get(ctx, s.names.PrivateKey, secretTypePrivateKey)
}

func (s *secureValues) ClientSecret(ctx context.Context) (common.RawSecureValue, error) {
	return s.get(ctx, s.names.ClientSecret, secretTypeClientSecret)
}

func (s *secureValues) Token(ctx context.Context) (common.RawSecureValue, error) {
	v, err := s.get(ctx, s.names.Token, secretTypeToken)
	if errors.Is(err, ErrSecretNotFound) {
		return "", fmt.Errorf("%w: %w", ErrTokenNotFound, err)
	}
	return v, err
}

func ProvideDecrypter(svc decrypt.DecryptService, metrics *DecryptMetrics) Decrypter {
	return func(c *provisioning.Connection) SecureValues {
		return &secureValues{svc: svc, metrics: metrics, names: c.Secure, namespace: c.Namespace}
	}
}
