package provisioning

import (
	"context"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	secretV1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret"
)

func TestSecureValues_Decrypt(t *testing.T) {
	getOutput := func(token, webhookSecret string) *decryptedValues {
		vals := &decryptedValues{}
		if token != "" {
			t := secretV1beta1.NewExposedSecureValue(token)
			vals.token = &t
		}
		if webhookSecret != "" {
			t := secretV1beta1.NewExposedSecureValue(webhookSecret)
			vals.webhookSecret = &t
		}
		return vals
	}
	newDecryptResult := func(value string) secret.DecryptResult {
		v := secretV1beta1.NewExposedSecureValue(value)
		return secret.NewDecryptResultValue(&v)
	}

	tests := []struct {
		name          string
		input         *provisioning.Repository
		decrypt       map[string]secret.DecryptResult
		expect        *decryptedValues
		expectedError string
	}{
		{
			name: "successful decrypt",
			input: &provisioning.Repository{
				Secure: provisioning.SecureValues{
					Token:         v0alpha1.InlineSecureValue{Name: "A"},
					WebhookSecret: v0alpha1.InlineSecureValue{Name: "B"},
				},
			},
			decrypt: map[string]secret.DecryptResult{
				"A": newDecryptResult("decrypted-token"),
				"B": newDecryptResult("decrypted-webhook-secret"),
			},
			expect: getOutput("decrypted-token", "decrypted-webhook-secret"),
		},
		{
			name: "missing webhook value",
			input: &provisioning.Repository{
				Secure: provisioning.SecureValues{
					Token:         v0alpha1.InlineSecureValue{Name: "A"},
					WebhookSecret: v0alpha1.InlineSecureValue{Name: "B"},
				},
			},
			decrypt: map[string]secret.DecryptResult{
				"A": newDecryptResult("decrypted-token"),
				// No value for B
			},
			expect:        getOutput("decrypted-token", ""),
			expectedError: "Unable to read secret: secure.webhookSecret",
		},
		{
			name: "missing token value",
			input: &provisioning.Repository{
				Secure: provisioning.SecureValues{
					Token:         v0alpha1.InlineSecureValue{Name: "A"},
					WebhookSecret: v0alpha1.InlineSecureValue{Name: "B"},
				},
			},
			decrypt: map[string]secret.DecryptResult{
				"B": newDecryptResult("decrypted-webhook-secret"),
			},
			expect:        getOutput("", "decrypted-webhook-secret"),
			expectedError: "Unable to read secret: secure.token",
		},
		{
			name: "ok if missing secure values",
			input: &provisioning.Repository{
				Secure: provisioning.SecureValues{},
			},
			decrypt: map[string]secret.DecryptResult{},
			expect:  getOutput("", ""),
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			decryptSvc := secret.NewMockDecryptService(t)
			decryptSvc.EXPECT().Decrypt(mock.Anything, provisioning.GROUP, tt.input.Namespace,
				tt.input.Secure.Token.Name,
				tt.input.Secure.WebhookSecret.Name,
			).Return(tt.decrypt, nil).Once()

			decrypted, err := decrypt(context.Background(), tt.input, decryptSvc)
			if tt.expectedError != "" {
				if err == nil || err.Error() != tt.expectedError {
					t.Errorf("expected error %q, got %v", tt.expectedError, err)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			require.NotNil(t, decrypted, "decrypted values should not be nil")
			require.Equal(t, tt.expect, decrypted, "decrypted values do not match expected output")
			decryptSvc.AssertExpectations(t)
		})
	}
}
