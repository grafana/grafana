package repository

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/apps/secret/pkg/decrypt"
	"github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

func TestRepositorySecureValues(t *testing.T) {
	type expectedDecryptedResult struct {
		value string
		error string
	}

	tests := []struct {
		name    string
		config  *provisioning.Repository
		decrypt decryptFn
		token   expectedDecryptedResult
		webhook expectedDecryptedResult
	}{
		{
			name: "referenced by name",
			config: &provisioning.Repository{
				Secure: provisioning.SecureValues{
					Token: v0alpha1.InlineSecureValue{
						Name: "secret",
					},
				},
			},
			decrypt: func(t *testing.T, names ...string) (map[string]decrypt.DecryptResult, error) {
				require.Equal(t, []string{"secret"}, names)
				val := secretv1beta1.NewExposedSecureValue(names[0])
				return map[string]decrypt.DecryptResult{
					names[0]: decrypt.NewDecryptResultValue(&val),
				}, nil
			},
			token: expectedDecryptedResult{
				value: "secret",
			},
		},
		{
			name: "when create exists, use it",
			config: &provisioning.Repository{
				Secure: provisioning.SecureValues{
					Token: v0alpha1.InlineSecureValue{
						Create: "secret",
					},
				},
			},
			decrypt: func(t *testing.T, names ...string) (map[string]decrypt.DecryptResult, error) {
				t.Fatal("decrypt should not be called when Create is set")
				return nil, nil
			},
			token: expectedDecryptedResult{
				value: "secret",
			},
		},
		{
			name: "avoid decrypt when no values are configured",
			config: &provisioning.Repository{
				Secure: provisioning.SecureValues{},
			},
			decrypt: func(t *testing.T, names ...string) (map[string]decrypt.DecryptResult, error) {
				t.Fatal("decrypt should not be called when no values are configured")
				return nil, nil
			},
		},
		{
			name: "propagate error from service",
			config: &provisioning.Repository{
				Secure: provisioning.SecureValues{
					WebhookSecret: v0alpha1.InlineSecureValue{
						Name: "secret",
					},
				},
			},
			decrypt: func(t *testing.T, names ...string) (map[string]decrypt.DecryptResult, error) {
				require.Equal(t, []string{"secret"}, names)
				return map[string]decrypt.DecryptResult{
					names[0]: decrypt.NewDecryptResultErr(fmt.Errorf("error for name")),
				}, nil
			},
			webhook: expectedDecryptedResult{
				error: "error for name",
			},
		},
		{
			name: "not found",
			config: &provisioning.Repository{
				Secure: provisioning.SecureValues{
					Token: v0alpha1.InlineSecureValue{
						Name: "secret",
					},
				},
			},
			decrypt: func(t *testing.T, names ...string) (map[string]decrypt.DecryptResult, error) {
				return map[string]decrypt.DecryptResult{}, nil
			},
			token: expectedDecryptedResult{
				error: "not found", // it is not in the results above
			},
		},
		{
			name: "not found",
			config: &provisioning.Repository{
				Secure: provisioning.SecureValues{
					WebhookSecret: v0alpha1.InlineSecureValue{
						Name: "secret",
					},
				},
			},
			decrypt: func(t *testing.T, names ...string) (map[string]decrypt.DecryptResult, error) {
				return nil, fmt.Errorf("explode")
			},
			webhook: expectedDecryptedResult{
				error: "failed to call decrypt service",
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			decrypter := ProvideDecrypter(&dummyDecryptService{t: t, fn: tt.decrypt})
			decrypted := decrypter(tt.config)

			token, err := decrypted.Token(context.Background())
			if tt.token.error != "" {
				require.ErrorContains(t, err, tt.token.error)
			} else {
				require.NoError(t, err)
				require.Equal(t, tt.token.value, string(token))
			}

			webhook, err := decrypted.WebhookSecret(context.Background())
			if tt.webhook.error != "" {
				require.ErrorContains(t, err, tt.webhook.error)
			} else {
				require.NoError(t, err)
				require.Equal(t, tt.webhook.value, string(webhook))
			}
		})
	}
}

type decryptFn = func(t *testing.T, names ...string) (map[string]decrypt.DecryptResult, error)

type dummyDecryptService struct {
	t  *testing.T
	fn decryptFn
}

func (d *dummyDecryptService) Decrypt(_ context.Context, _ string, _ string, names ...string) (map[string]decrypt.DecryptResult, error) {
	return d.fn(d.t, names...)
}
