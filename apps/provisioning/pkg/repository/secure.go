package repository

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

	// ErrTokenNotFound is ErrSecretNotFound scoped to the repository token, letting
	// the controller regenerate only when the token itself is the missing secret.
	ErrTokenNotFound = errors.New("token secure value could not be decrypted")
)

type secretTypeLabel string

const (
	secretTypeToken            secretTypeLabel = "token"
	secretTypeWebhookSecret    secretTypeLabel = "webhook_secret"
	secretTypeCommitSigningKey secretTypeLabel = "commit_signing_key"
)

type Decrypter = func(r *provisioning.Repository) SecureValues

type SecureValues interface {
	Token(ctx context.Context) (common.RawSecureValue, error)
	WebhookSecret(ctx context.Context) (common.RawSecureValue, error)
	CommitSigningKey(ctx context.Context) (common.RawSecureValue, error)
}

type secureValues struct {
	svc       decrypt.DecryptService
	metrics   *DecryptMetrics
	names     provisioning.SecureValues
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

func (s *secureValues) Token(ctx context.Context) (common.RawSecureValue, error) {
	v, err := s.get(ctx, s.names.Token, secretTypeToken)
	if errors.Is(err, ErrSecretNotFound) {
		return "", fmt.Errorf("%w: %w", ErrTokenNotFound, err)
	}
	return v, err
}

func (s *secureValues) WebhookSecret(ctx context.Context) (common.RawSecureValue, error) {
	return s.get(ctx, s.names.WebhookSecret, secretTypeWebhookSecret)
}

func (s *secureValues) CommitSigningKey(ctx context.Context) (common.RawSecureValue, error) {
	return s.get(ctx, s.names.CommitSigningKey, secretTypeCommitSigningKey)
}

func ProvideDecrypter(svc decrypt.DecryptService, metrics *DecryptMetrics) Decrypter {
	return func(r *provisioning.Repository) SecureValues {
		return &secureValues{svc: svc, metrics: metrics, names: r.Secure, namespace: r.Namespace}
	}
}
