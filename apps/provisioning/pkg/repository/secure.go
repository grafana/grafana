package repository

import (
	"context"
	"fmt"
	"time"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/secret/pkg/decrypt"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

type secretTypeLabel string

const (
	secretTypeToken         secretTypeLabel = "token"
	secretTypeWebhookSecret secretTypeLabel = "webhook_secret"
)

type Decrypter = func(r *provisioning.Repository) SecureValues

type SecureValues interface {
	Token(ctx context.Context) (common.RawSecureValue, error)
	WebhookSecret(ctx context.Context) (common.RawSecureValue, error)
}

type secureValues struct {
	svc       decrypt.DecryptService
	metrics   *DecryptMetrics
	names     provisioning.SecureValues
	namespace string
}

func (s *secureValues) get(ctx context.Context, sv common.InlineSecureValue, st secretTypeLabel) (common.RawSecureValue, error) {
	if !sv.Create.IsZero() {
		return sv.Create, nil // If this was called before the value is actually saved
	}
	if sv.Name == "" {
		return "", nil
	}

	start := time.Now()
	results, err := s.svc.Decrypt(ctx, provisioning.GROUP, s.namespace, sv.Name)
	elapsed := time.Since(start).Seconds()

	if err != nil {
		s.metrics.recordError(st)
		return "", fmt.Errorf("failed to call decrypt service: %w", err)
	}

	v, found := results[sv.Name]
	if !found {
		s.metrics.recordError(st)
		return "", fmt.Errorf("not found")
	}
	if v.Error() != nil {
		s.metrics.recordError(st)
		return "", v.Error()
	}

	s.metrics.recordSuccess(st, elapsed)
	return common.RawSecureValue(*v.Value()), nil
}

func (s *secureValues) Token(ctx context.Context) (common.RawSecureValue, error) {
	return s.get(ctx, s.names.Token, secretTypeToken)
}

func (s *secureValues) WebhookSecret(ctx context.Context) (common.RawSecureValue, error) {
	return s.get(ctx, s.names.WebhookSecret, secretTypeWebhookSecret)
}

func ProvideDecrypter(svc decrypt.DecryptService, metrics *DecryptMetrics) Decrypter {
	return func(r *provisioning.Repository) SecureValues {
		return &secureValues{svc: svc, metrics: metrics, names: r.Secure, namespace: r.Namespace}
	}
}
