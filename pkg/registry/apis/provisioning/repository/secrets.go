package repository

import (
	context "context"
	"fmt"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
)

type Decrypter = func(ctx context.Context, r *provisioning.Repository) (SecureValues, error)

type SecureValues interface {
	Token() (common.RawSecureValue, error)
	WebhookSecret() (common.RawSecureValue, error)
}

type secureValues struct {
	names   provisioning.SecureValues
	results map[string]contracts.DecryptResult
}

func (s *secureValues) get(name string) (common.RawSecureValue, error) {
	if name == "" {
		return "", nil
	}
	v, found := s.results[name]
	if !found {
		return "", fmt.Errorf("not found")
	}
	if v.Error() != nil {
		return "", v.Error()
	}
	return common.RawSecureValue(*v.Value()), nil
}

func (s *secureValues) Token() (common.RawSecureValue, error) {
	return s.get(s.names.Token.Name)
}

func (s *secureValues) WebhookSecret() (common.RawSecureValue, error) {
	return s.get(s.names.WebhookSecret.Name)
}

func DecryptService(svc contracts.DecryptService) Decrypter {
	return func(ctx context.Context, r *provisioning.Repository) (SecureValues, error) {
		results, err := svc.Decrypt(ctx, provisioning.GROUP, r.Namespace,
			r.Secure.Token.Name,
			r.Secure.WebhookSecret.Name,
		)
		if err != nil {
			return nil, err
		}
		return &secureValues{names: r.Secure, results: results}, nil
	}
}
