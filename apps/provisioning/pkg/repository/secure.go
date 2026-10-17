package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/secret/pkg/decrypt"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

var (
	// ErrSecretNotFound indicates that a secure value is referenced by name but the
	// underlying secret genuinely does not exist (deleted or never persisted). It is
	// deliberately NOT returned for other decrypt failures (e.g. not authorized, keeper
	// errors) where the secret exists but cannot be read right now: those are surfaced
	// so the reconcile retries instead of regenerating and overwriting the token.
	ErrSecretNotFound = errors.New("secure value not found")

	// ErrTokenNotFound is ErrSecretNotFound scoped to the repository token, letting
	// the controller regenerate only when the token itself is the missing secret.
	ErrTokenNotFound = errors.New("token secure value not found")

	// ErrSecretDecryptFailed indicates the secret exists but could not be read right
	// now -- the decrypt service was unreachable, or the keeper/KMS returned an error.
	// It is a transient, infrastructure-side failure outside the user's control, so
	// callers should classify it as a service issue to retry rather than as an invalid
	// repository configuration to fix.
	ErrSecretDecryptFailed = errors.New("secure value could not be decrypted")
)

// decryptTimeout bounds a single decrypt call so a hung or unreachable secrets
// service can't block a reconcile indefinitely. It covers the gRPC client's
// internal retries, which share this context. Reconcile retries on failure, so
// this is a fail-fast bound, not a hard SLA.
const decryptTimeout = 30 * time.Second

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

	// Span the decrypt call so a hung or slow secrets service shows up as a bounded
	// span under repository.build rather than an uninstrumented gap. Started before
	// the timeout so it covers the full bound and the gRPC client's shared-context
	// retries. The tracer is taken from the active span already in ctx to avoid
	// threading one through ProvideDecrypter.
	ctx, span := trace.SpanFromContext(ctx).TracerProvider().
		Tracer("github.com/grafana/grafana/apps/provisioning/pkg/repository").
		Start(ctx, "provisioning.repository.decrypt",
			trace.WithAttributes(
				attribute.String("namespace", s.namespace),
				attribute.String("secret.name", sv.Name),
				attribute.String("secret.type", string(st)),
			),
		)
	defer span.End()

	start := time.Now()
	defer func() {
		elapsed := time.Since(start).Seconds()
		if err != nil {
			s.metrics.recordError(st)
			span.RecordError(err)
		} else {
			s.metrics.recordSuccess(st, elapsed)
		}
	}()

	ctx, cancel := context.WithTimeout(ctx, decryptTimeout)
	defer cancel()

	results, err := s.svc.Decrypt(ctx, provisioning.GROUP, s.namespace, sv.Name)
	if err != nil {
		return "", fmt.Errorf("%w: failed to call decrypt service: %w", ErrSecretDecryptFailed, err)
	}

	v, found := results[sv.Name]
	if !found {
		return "", fmt.Errorf("%w: %q", ErrSecretNotFound, sv.Name)
	}
	if err := v.Error(); err != nil {
		// Only a genuinely absent secret should let callers regenerate. Other per-item
		// failures (not authorized, keeper/KMS errors) mean the secret exists but cannot
		// be read now, so surface them for retry rather than overwriting the value. The
		// typed decrypt errors are not importable here and are flattened to plain strings
		// across the gRPC boundary, so match on the message.
		if isNotFoundErr(err) {
			return "", fmt.Errorf("%w: %q: %w", ErrSecretNotFound, sv.Name, err)
		}
		return "", fmt.Errorf("%w: decrypt %q: %w", ErrSecretDecryptFailed, sv.Name, err)
	}

	return common.RawSecureValue(*v.Value()), nil
}

// isNotFoundErr reports whether a per-item decrypt error means the secret does not
// exist (as opposed to existing but being unreadable).
func isNotFoundErr(err error) bool {
	return err != nil && strings.Contains(strings.ToLower(err.Error()), "not found")
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
