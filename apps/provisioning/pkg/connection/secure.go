package connection

import (
	"context"
	"fmt"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/secret/pkg/decrypt"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

type Decrypter = func(c *provisioning.Connection) SecureValues

type SecureValues interface {
	PrivateKey(ctx context.Context) (common.RawSecureValue, error)
	ClientSecret(ctx context.Context) (common.RawSecureValue, error)
	Token(ctx context.Context) (common.RawSecureValue, error)
}

type secureValues struct {
	svc       decrypt.DecryptService
	names     provisioning.ConnectionSecure
	namespace string
}

func (s *secureValues) get(ctx context.Context, sv common.InlineSecureValue) (common.RawSecureValue, error) {
	if !sv.Create.IsZero() {
		return sv.Create, nil // If this was called before the value is actually saved
	}
	if sv.Name == "" {
		return "", nil
	}
	results, err := s.svc.Decrypt(ctx, provisioning.GROUP, s.namespace, sv.Name)
	if err != nil {
		return "", fmt.Errorf("failed to call decrypt service: %w", err)
	}

	v, found := results[sv.Name]
	if !found {
		return "", fmt.Errorf("not found")
	}
	if v.Error() != nil {
		return "", v.Error()
	}
	return common.RawSecureValue(*v.Value()), nil
}

func (s *secureValues) PrivateKey(ctx context.Context) (common.RawSecureValue, error) {
	return s.get(ctx, s.names.PrivateKey)
}

func (s *secureValues) ClientSecret(ctx context.Context) (common.RawSecureValue, error) {
	return s.get(ctx, s.names.ClientSecret)
}

func (s *secureValues) Token(ctx context.Context) (common.RawSecureValue, error) {
	return s.get(ctx, s.names.Token)
}

func ProvideDecrypter(svc decrypt.DecryptService) Decrypter {
	return func(c *provisioning.Connection) SecureValues {
		return &secureValues{svc: svc, names: c.Secure, namespace: c.Namespace}
	}
}
