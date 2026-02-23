package connection_test

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/apps/secret/pkg/decrypt"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

// mockDecryptService implements decrypt.DecryptService for testing
type mockDecryptService struct {
	results map[string]decrypt.DecryptResult
	err     error
}

func (m *mockDecryptService) Decrypt(ctx context.Context, group, namespace string, names ...string) (map[string]decrypt.DecryptResult, error) {
	if m.err != nil {
		return nil, m.err
	}

	results := make(map[string]decrypt.DecryptResult)
	for _, name := range names {
		if result, ok := m.results[name]; ok {
			results[name] = result
		}
	}
	return results, nil
}

func newDecryptResult(value string) decrypt.DecryptResult {
	v := secretv1beta1.ExposedSecureValue(value)
	return decrypt.NewDecryptResultValue(&v)
}

func newDecryptResultWithError(err error) decrypt.DecryptResult {
	return decrypt.NewDecryptResultErr(err)
}

func TestProvideDecrypter(t *testing.T) {
	t.Run("should return a decrypter function", func(t *testing.T) {
		mockSvc := &mockDecryptService{}
		decrypter := connection.ProvideDecrypter(mockSvc)

		require.NotNil(t, decrypter)

		conn := &provisioning.Connection{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "test-connection",
				Namespace: "default",
			},
		}

		result := decrypter(conn)
		require.NotNil(t, result)
	})
}

func TestSecureValues_PrivateKey(t *testing.T) {
	tests := []struct {
		name          string
		connection    *provisioning.Connection
		mockResults   map[string]decrypt.DecryptResult
		mockErr       error
		expectedValue common.RawSecureValue
		expectedError string
	}{
		{
			name: "returns Create value when present",
			connection: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-connection",
					Namespace: "default",
				},
				Secure: provisioning.ConnectionSecure{
					PrivateKey: common.InlineSecureValue{
						Create: common.NewSecretValue("create-private-key"),
					},
				},
			},
			expectedValue: common.RawSecureValue("create-private-key"),
		},
		{
			name: "returns empty when Name is empty",
			connection: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-connection",
					Namespace: "default",
				},
				Secure: provisioning.ConnectionSecure{
					PrivateKey: common.InlineSecureValue{},
				},
			},
			expectedValue: "",
		},
		{
			name: "decrypts from service when Name is provided",
			connection: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-connection",
					Namespace: "default",
				},
				Secure: provisioning.ConnectionSecure{
					PrivateKey: common.InlineSecureValue{
						Name: "private-key-ref",
					},
				},
			},
			mockResults: map[string]decrypt.DecryptResult{
				"private-key-ref": newDecryptResult("decrypted-private-key"),
			},
			expectedValue: common.RawSecureValue("decrypted-private-key"),
		},
		{
			name: "returns error when decrypt service fails",
			connection: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-connection",
					Namespace: "default",
				},
				Secure: provisioning.ConnectionSecure{
					PrivateKey: common.InlineSecureValue{
						Name: "private-key-ref",
					},
				},
			},
			mockErr:       errors.New("decrypt service error"),
			expectedError: "failed to call decrypt service",
		},
		{
			name: "returns error when value not found",
			connection: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-connection",
					Namespace: "default",
				},
				Secure: provisioning.ConnectionSecure{
					PrivateKey: common.InlineSecureValue{
						Name: "missing-key",
					},
				},
			},
			mockResults:   map[string]decrypt.DecryptResult{},
			expectedError: "not found",
		},
		{
			name: "returns error when decrypt result has error",
			connection: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-connection",
					Namespace: "default",
				},
				Secure: provisioning.ConnectionSecure{
					PrivateKey: common.InlineSecureValue{
						Name: "private-key-ref",
					},
				},
			},
			mockResults: map[string]decrypt.DecryptResult{
				"private-key-ref": newDecryptResultWithError(errors.New("decryption failed")),
			},
			expectedError: "decryption failed",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockSvc := &mockDecryptService{
				results: tt.mockResults,
				err:     tt.mockErr,
			}

			decrypter := connection.ProvideDecrypter(mockSvc)
			secureVals := decrypter(tt.connection)

			value, err := secureVals.PrivateKey(context.Background())

			if tt.expectedError != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
			} else {
				require.NoError(t, err)
				assert.Equal(t, tt.expectedValue, value)
			}
		})
	}
}

func TestSecureValues_ClientSecret(t *testing.T) {
	tests := []struct {
		name          string
		connection    *provisioning.Connection
		mockResults   map[string]decrypt.DecryptResult
		mockErr       error
		expectedValue common.RawSecureValue
		expectedError string
	}{
		{
			name: "returns Create value when present",
			connection: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-connection",
					Namespace: "default",
				},
				Secure: provisioning.ConnectionSecure{
					ClientSecret: common.InlineSecureValue{
						Create: common.NewSecretValue("create-client-secret"),
					},
				},
			},
			expectedValue: common.RawSecureValue("create-client-secret"),
		},
		{
			name: "returns empty when Name is empty",
			connection: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-connection",
					Namespace: "default",
				},
				Secure: provisioning.ConnectionSecure{
					ClientSecret: common.InlineSecureValue{},
				},
			},
			expectedValue: "",
		},
		{
			name: "decrypts from service when Name is provided",
			connection: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-connection",
					Namespace: "default",
				},
				Secure: provisioning.ConnectionSecure{
					ClientSecret: common.InlineSecureValue{
						Name: "client-secret-ref",
					},
				},
			},
			mockResults: map[string]decrypt.DecryptResult{
				"client-secret-ref": newDecryptResult("decrypted-client-secret"),
			},
			expectedValue: common.RawSecureValue("decrypted-client-secret"),
		},
		{
			name: "returns error when decrypt service fails",
			connection: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-connection",
					Namespace: "default",
				},
				Secure: provisioning.ConnectionSecure{
					ClientSecret: common.InlineSecureValue{
						Name: "client-secret-ref",
					},
				},
			},
			mockErr:       errors.New("decrypt service error"),
			expectedError: "failed to call decrypt service",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockSvc := &mockDecryptService{
				results: tt.mockResults,
				err:     tt.mockErr,
			}

			decrypter := connection.ProvideDecrypter(mockSvc)
			secureVals := decrypter(tt.connection)

			value, err := secureVals.ClientSecret(context.Background())

			if tt.expectedError != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
			} else {
				require.NoError(t, err)
				assert.Equal(t, tt.expectedValue, value)
			}
		})
	}
}

func TestSecureValues_Token(t *testing.T) {
	tests := []struct {
		name          string
		connection    *provisioning.Connection
		mockResults   map[string]decrypt.DecryptResult
		mockErr       error
		expectedValue common.RawSecureValue
		expectedError string
	}{
		{
			name: "returns Create value when present",
			connection: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-connection",
					Namespace: "default",
				},
				Secure: provisioning.ConnectionSecure{
					Token: common.InlineSecureValue{
						Create: common.NewSecretValue("create-token"),
					},
				},
			},
			expectedValue: common.RawSecureValue("create-token"),
		},
		{
			name: "returns empty when Name is empty",
			connection: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-connection",
					Namespace: "default",
				},
				Secure: provisioning.ConnectionSecure{
					Token: common.InlineSecureValue{},
				},
			},
			expectedValue: "",
		},
		{
			name: "decrypts from service when Name is provided",
			connection: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-connection",
					Namespace: "default",
				},
				Secure: provisioning.ConnectionSecure{
					Token: common.InlineSecureValue{
						Name: "token-ref",
					},
				},
			},
			mockResults: map[string]decrypt.DecryptResult{
				"token-ref": newDecryptResult("decrypted-token"),
			},
			expectedValue: common.RawSecureValue("decrypted-token"),
		},
		{
			name: "returns error when decrypt service fails",
			connection: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-connection",
					Namespace: "default",
				},
				Secure: provisioning.ConnectionSecure{
					Token: common.InlineSecureValue{
						Name: "token-ref",
					},
				},
			},
			mockErr:       errors.New("decrypt service error"),
			expectedError: "failed to call decrypt service",
		},
		{
			name: "returns error when value not found",
			connection: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-connection",
					Namespace: "default",
				},
				Secure: provisioning.ConnectionSecure{
					Token: common.InlineSecureValue{
						Name: "missing-token",
					},
				},
			},
			mockResults:   map[string]decrypt.DecryptResult{},
			expectedError: "not found",
		},
		{
			name: "returns error when decrypt result has error",
			connection: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-connection",
					Namespace: "default",
				},
				Secure: provisioning.ConnectionSecure{
					Token: common.InlineSecureValue{
						Name: "token-ref",
					},
				},
			},
			mockResults: map[string]decrypt.DecryptResult{
				"token-ref": newDecryptResultWithError(errors.New("decryption failed")),
			},
			expectedError: "decryption failed",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockSvc := &mockDecryptService{
				results: tt.mockResults,
				err:     tt.mockErr,
			}

			decrypter := connection.ProvideDecrypter(mockSvc)
			secureVals := decrypter(tt.connection)

			value, err := secureVals.Token(context.Background())

			if tt.expectedError != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
			} else {
				require.NoError(t, err)
				assert.Equal(t, tt.expectedValue, value)
			}
		})
	}
}

func TestSecureValues_MultipleFields(t *testing.T) {
	t.Run("should decrypt all fields independently", func(t *testing.T) {
		conn := &provisioning.Connection{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "test-connection",
				Namespace: "default",
			},
			Secure: provisioning.ConnectionSecure{
				PrivateKey: common.InlineSecureValue{
					Name: "private-key-ref",
				},
				ClientSecret: common.InlineSecureValue{
					Name: "client-secret-ref",
				},
				Token: common.InlineSecureValue{
					Name: "token-ref",
				},
			},
		}

		mockSvc := &mockDecryptService{
			results: map[string]decrypt.DecryptResult{
				"private-key-ref":   newDecryptResult("decrypted-private-key"),
				"client-secret-ref": newDecryptResult("decrypted-client-secret"),
				"token-ref":         newDecryptResult("decrypted-token"),
			},
		}

		decrypter := connection.ProvideDecrypter(mockSvc)
		secureVals := decrypter(conn)

		privateKey, err := secureVals.PrivateKey(context.Background())
		require.NoError(t, err)
		assert.Equal(t, common.RawSecureValue("decrypted-private-key"), privateKey)

		clientSecret, err := secureVals.ClientSecret(context.Background())
		require.NoError(t, err)
		assert.Equal(t, common.RawSecureValue("decrypted-client-secret"), clientSecret)

		token, err := secureVals.Token(context.Background())
		require.NoError(t, err)
		assert.Equal(t, common.RawSecureValue("decrypted-token"), token)
	})

	t.Run("should handle mix of Create and Name references", func(t *testing.T) {
		conn := &provisioning.Connection{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "test-connection",
				Namespace: "default",
			},
			Secure: provisioning.ConnectionSecure{
				PrivateKey: common.InlineSecureValue{
					Create: common.NewSecretValue("inline-private-key"),
				},
				ClientSecret: common.InlineSecureValue{
					Name: "client-secret-ref",
				},
				Token: common.InlineSecureValue{
					Create: common.NewSecretValue("inline-token"),
				},
			},
		}

		mockSvc := &mockDecryptService{
			results: map[string]decrypt.DecryptResult{
				"client-secret-ref": newDecryptResult("decrypted-client-secret"),
			},
		}

		decrypter := connection.ProvideDecrypter(mockSvc)
		secureVals := decrypter(conn)

		// PrivateKey should return Create value without calling decrypt
		privateKey, err := secureVals.PrivateKey(context.Background())
		require.NoError(t, err)
		assert.Equal(t, common.RawSecureValue("inline-private-key"), privateKey)

		// ClientSecret should decrypt
		clientSecret, err := secureVals.ClientSecret(context.Background())
		require.NoError(t, err)
		assert.Equal(t, common.RawSecureValue("decrypted-client-secret"), clientSecret)

		// Token should return Create value without calling decrypt
		token, err := secureVals.Token(context.Background())
		require.NoError(t, err)
		assert.Equal(t, common.RawSecureValue("inline-token"), token)
	})
}
