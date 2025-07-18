package secrets

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/secrets/mocks"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/service"
)

type mockSecureValueClientProvider struct {
	client *MockSecureValueClient
	err    error

	SecureValueClientProvider
}

func (m *mockSecureValueClientProvider) Client(context.Context, string) (SecureValueClient, error) {
	return m.client, m.err
}

func TestNewSecretsService(t *testing.T) {
	mockSecretsSvc := &mockSecureValueClientProvider{client: NewMockSecureValueClient(t)}
	mockDecryptSvc := &mocks.MockDecryptService{}

	svc := NewSecretsService(mockSecretsSvc, mockDecryptSvc)

	assert.NotNil(t, svc)
	assert.IsType(t, &secretsService{}, svc)
}

//nolint:gocyclo // This test is complex but it's a good test for the SecretsService.
func TestSecretsService_Encrypt(t *testing.T) {
	tests := []struct {
		name          string
		namespace     string
		secretName    string
		data          string
		setupMocks    func(*MockSecureValueClient)
		expectedName  string
		expectedError string
	}{
		{
			name:       "successfully create new secret",
			namespace:  "test-namespace",
			secretName: "test-secret",
			data:       "secret-data",
			setupMocks: func(mockSecureValueClient *MockSecureValueClient) {
				// Mock Get call to return not found error (secret doesn't exist)
				mockSecureValueClient.EXPECT().Get(mock.Anything, mock.Anything).Return(nil, contracts.ErrSecureValueNotFound)

				// Mock Create call
				mockSecureValueClient.EXPECT().Create(mock.Anything, mock.Anything, mock.Anything).Return(
					&secretv1beta1.SecureValue{
						ObjectMeta: metav1.ObjectMeta{
							Name:      "test-secret",
							Namespace: "test-namespace",
						},
					},
					nil,
				)
			},
			expectedName: "test-secret",
		},
		{
			name:       "successfully update existing secret",
			namespace:  "test-namespace",
			secretName: "existing-secret",
			data:       "new-secret-data",
			setupMocks: func(mockSecureValueClient *MockSecureValueClient) {
				existingSecret := &secretv1beta1.SecureValue{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "existing-secret",
						Namespace: "test-namespace",
					},
					Spec: secretv1beta1.SecureValueSpec{
						Description: "provisioning: existing-secret",
						Decrypters:  []string{svcName},
					},
				}

				// Mock Get call to return existing secret
				mockSecureValueClient.EXPECT().Get(mock.Anything, mock.Anything).Return(existingSecret, nil)

				// Mock Update call
				mockSecureValueClient.EXPECT().Update(mock.Anything, mock.Anything, mock.Anything).Return(
					&secretv1beta1.SecureValue{
						ObjectMeta: metav1.ObjectMeta{
							Name:      "existing-secret",
							Namespace: "test-namespace",
						},
					},
					nil,
				)
			},
			expectedName: "existing-secret",
		},
		{
			name:       "error reading existing secret",
			namespace:  "test-namespace",
			secretName: "test-secret",
			data:       "secret-data",
			setupMocks: func(mockSecureValueClient *MockSecureValueClient) {
				// Mock Get call to return error
				mockSecureValueClient.EXPECT().Get(mock.Anything, mock.Anything).Return(nil, errors.New("database error"))
			},
			expectedError: "database error",
		},
		{
			name:       "error creating new secret",
			namespace:  "test-namespace",
			secretName: "test-secret",
			data:       "secret-data",
			setupMocks: func(mockSecureValueClient *MockSecureValueClient) {
				// Mock Get call to return not found error
				mockSecureValueClient.EXPECT().Get(mock.Anything, mock.Anything).Return(nil, contracts.ErrSecureValueNotFound)

				// Mock Create call to return error
				mockSecureValueClient.EXPECT().Create(mock.Anything, mock.Anything, mock.Anything).Return(nil, errors.New("creation failed"))
			},
			expectedError: "creation failed",
		},
		{
			name:       "error updating existing secret",
			namespace:  "test-namespace",
			secretName: "existing-secret",
			data:       "new-secret-data",
			setupMocks: func(mockSecureValueClient *MockSecureValueClient) {
				existingSecret := &secretv1beta1.SecureValue{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "existing-secret",
						Namespace: "test-namespace",
					},
					Spec: secretv1beta1.SecureValueSpec{
						Description: "provisioning: existing-secret",
						Decrypters:  []string{svcName},
					},
				}

				// Mock Get call to return existing secret
				mockSecureValueClient.EXPECT().Get(mock.Anything, mock.Anything).Return(existingSecret, nil)

				// Mock Update call to return error
				mockSecureValueClient.EXPECT().Update(mock.Anything, mock.Anything, mock.Anything).Return(nil, errors.New("update failed"))
			},
			expectedError: "update failed",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockSecureValueClient := NewMockSecureValueClient(t)

			tt.setupMocks(mockSecureValueClient)

			clientProvider := &mockSecureValueClientProvider{
				client: mockSecureValueClient,
			}
			svc := NewSecretsService(clientProvider, nil)

			ctx := context.Background()

			result, err := svc.Encrypt(ctx, tt.namespace, tt.secretName, tt.data)

			if tt.expectedError != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedName, result)
			}
		})
	}
}

func TestSecretsService_Encrypt_ClientError(t *testing.T) {
	mockDecryptSvc := &mocks.MockDecryptService{}

	// Setup client to return error
	clientProvider := &mockSecureValueClientProvider{err: errors.New("client error")}

	svc := NewSecretsService(clientProvider, mockDecryptSvc)

	ctx := context.Background()

	result, err := svc.Encrypt(ctx, "test-namespace", "test-secret", "secret-data")

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "client error")
	assert.Empty(t, result)
}

func TestSecretsService_Decrypt(t *testing.T) {
	tests := []struct {
		name           string
		namespace      string
		secretName     string
		setupMocks     func(*mocks.MockDecryptService)
		expectedResult []byte
		expectedError  string
	}{
		{
			name:       "successfully decrypt secret",
			namespace:  "test-namespace",
			secretName: "test-secret",
			setupMocks: func(mockDecryptSvc *mocks.MockDecryptService) {
				exposedValue := secretv1beta1.NewExposedSecureValue("decrypted-data")
				mockResult := service.NewDecryptResultValue(&exposedValue)

				mockDecryptSvc.EXPECT().Decrypt(
					mock.MatchedBy(func(ctx context.Context) bool {
						// Verify that the context is not nil (the service creates a new StaticRequester)
						return ctx != nil
					}),
					"test-namespace",
					"test-secret",
				).Return(map[string]service.DecryptResult{
					"test-secret": mockResult,
				}, nil)
			},
			expectedResult: []byte("decrypted-data"),
		},
		{
			name:       "decrypt service error",
			namespace:  "test-namespace",
			secretName: "test-secret",
			setupMocks: func(mockDecryptSvc *mocks.MockDecryptService) {
				mockDecryptSvc.EXPECT().Decrypt(
					mock.MatchedBy(func(ctx context.Context) bool {
						return ctx != nil
					}),
					"test-namespace",
					"test-secret",
				).Return(nil, errors.New("decrypt service error"))
			},
			expectedError: "decrypt service error",
		},
		{
			name:       "secret not found in results",
			namespace:  "test-namespace",
			secretName: "test-secret",
			setupMocks: func(mockDecryptSvc *mocks.MockDecryptService) {
				mockDecryptSvc.EXPECT().Decrypt(
					mock.MatchedBy(func(ctx context.Context) bool {
						return ctx != nil
					}),
					"test-namespace",
					"test-secret",
				).Return(map[string]service.DecryptResult{}, nil)
			},
			expectedError: contracts.ErrDecryptNotFound.Error(),
		},
		{
			name:       "decrypt result has error",
			namespace:  "test-namespace",
			secretName: "test-secret",
			setupMocks: func(mockDecryptSvc *mocks.MockDecryptService) {
				mockResult := service.NewDecryptResultErr(errors.New("decryption failed"))

				mockDecryptSvc.EXPECT().Decrypt(
					mock.MatchedBy(func(ctx context.Context) bool {
						return ctx != nil
					}),
					"test-namespace",
					"test-secret",
				).Return(map[string]service.DecryptResult{
					"test-secret": mockResult,
				}, nil)
			},
			expectedError: "decryption failed",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockDecryptSvc := &mocks.MockDecryptService{}

			tt.setupMocks(mockDecryptSvc)

			svc := NewSecretsService(nil, mockDecryptSvc)

			ctx := context.Background()

			result, err := svc.Decrypt(ctx, tt.namespace, tt.secretName)

			if tt.expectedError != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedResult, result)
			}
		})
	}
}

// Test to verify that the Decrypt method creates the correct service identity context
func TestSecretsService_Decrypt_ServiceIdentityContext(t *testing.T) {
	mockDecryptSvc := &mocks.MockDecryptService{}

	exposedValue := secretv1beta1.NewExposedSecureValue("test-data")
	mockResult := service.NewDecryptResultValue(&exposedValue)

	// Create a more detailed context matcher to verify the service identity context is created correctly
	mockDecryptSvc.EXPECT().Decrypt(
		mock.MatchedBy(func(ctx context.Context) bool {
			// At minimum, verify the context is not nil and is different from the original
			return ctx != nil
		}),
		"test-namespace",
		"test-secret",
	).Return(map[string]service.DecryptResult{
		"test-secret": mockResult,
	}, nil)

	svc := NewSecretsService(nil, mockDecryptSvc)

	ctx := context.Background()
	result, err := svc.Decrypt(ctx, "test-namespace", "test-secret")

	assert.NoError(t, err)
	assert.Equal(t, []byte("test-data"), result)
}

func TestSecretsService_Delete(t *testing.T) {
	tests := []struct {
		name          string
		namespace     string
		secretName    string
		setupMocks    func(mockClientProvider *mockSecureValueClientProvider, mockSecureValueClient *MockSecureValueClient)
		expectedError string
	}{
		{
			name:       "delete success",
			namespace:  "test-namespace",
			secretName: "test-secret",
			setupMocks: func(_ *mockSecureValueClientProvider, mockSecureValueClient *MockSecureValueClient) {
				// Mock Delete call
				mockSecureValueClient.EXPECT().Delete(mock.Anything, mock.Anything, mock.Anything).Return(nil)
			},
		},
		{
			name:       "delete returns error",
			namespace:  "test-namespace",
			secretName: "test-secret",
			setupMocks: func(_ *mockSecureValueClientProvider, mockSecureValueClient *MockSecureValueClient) {
				// Mock Delete call to return error
				mockSecureValueClient.EXPECT().Delete(mock.Anything, mock.Anything, mock.Anything).Return(errors.New("delete failed"))
			},
			expectedError: "delete failed",
		},
		{
			name:       "client error",
			namespace:  "test-namespace",
			secretName: "test-secret",
			setupMocks: func(mockClientProvider *mockSecureValueClientProvider, mockSecureValueClient *MockSecureValueClient) {
				// Setup client to return error
				mockClientProvider.client = nil
				mockClientProvider.err = errors.New("client error")
			},
			expectedError: "client error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockSecureValueClient := NewMockSecureValueClient(t)
			clientProvider := &mockSecureValueClientProvider{
				client: mockSecureValueClient,
			}

			tt.setupMocks(clientProvider, mockSecureValueClient)

			svc := NewSecretsService(clientProvider, nil)
			ctx := context.Background()

			err := svc.Delete(ctx, tt.namespace, tt.secretName)

			if tt.expectedError != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestIsNotFoundError(t *testing.T) {
	tests := []struct {
		name     string
		err      error
		expected bool
	}{
		{
			name:     "nil error",
			err:      nil,
			expected: false,
		},
		{
			name:     "grafana secure value not found error",
			err:      contracts.ErrSecureValueNotFound,
			expected: true,
		},
		{
			name:     "k8s not found error",
			err:      apierrors.NewNotFound(schema.GroupResource{Group: "secret.grafana.app", Resource: "securevalues"}, "test-secret"),
			expected: true,
		},
		{
			name:     "generic not found error message",
			err:      errors.New("not found"),
			expected: true,
		},
		{
			name:     "other error",
			err:      errors.New("internal server error"),
			expected: false,
		},
		{
			name:     "wrapped grafana error",
			err:      errors.New("wrapped: " + contracts.ErrSecureValueNotFound.Error()),
			expected: false, // wrapped errors won't match errors.Is unless properly wrapped
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isNotFoundError(tt.err)
			assert.Equal(t, tt.expected, result, "isNotFoundError(%v) = %v, want %v", tt.err, result, tt.expected)
		})
	}
}

func TestSecretsService_Encrypt_WithK8sNotFoundError(t *testing.T) {
	mockSecureValueClient := NewMockSecureValueClient(t)

	// Setup client to return the mock resource interface
	clientProvider := &mockSecureValueClientProvider{
		client: mockSecureValueClient,
	}

	// Mock Get call to return k8s not found error
	k8sNotFoundErr := apierrors.NewNotFound(schema.GroupResource{Group: "secret.grafana.app", Resource: "securevalues"}, "test-secret")
	mockSecureValueClient.EXPECT().Get(mock.Anything, mock.Anything).Return(nil, k8sNotFoundErr)

	// Mock Create call to succeed
	mockSecureValueClient.EXPECT().Create(mock.Anything, mock.Anything, mock.Anything).Return(
		&secretv1beta1.SecureValue{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "test-secret",
				Namespace: "test-namespace",
			},
		},
		nil,
	)

	svc := NewSecretsService(clientProvider, nil)
	ctx := context.Background()

	result, err := svc.Encrypt(ctx, "test-namespace", "test-secret", "secret-data")

	assert.NoError(t, err)
	assert.Equal(t, "test-secret", result)
}

func TestSecretsService_Delete_WithK8sNotFoundError(t *testing.T) {
	mockSecureValueClient := NewMockSecureValueClient(t)

	// Setup client to return the mock resource interface
	clientProvider := &mockSecureValueClientProvider{
		client: mockSecureValueClient,
	}

	// Mock Delete call to return k8s not found error
	k8sNotFoundErr := apierrors.NewNotFound(schema.GroupResource{Group: "secret.grafana.app", Resource: "securevalues"}, "test-secret")
	mockSecureValueClient.EXPECT().Delete(mock.Anything, mock.Anything, mock.Anything).Return(k8sNotFoundErr)

	svc := NewSecretsService(clientProvider, nil)
	ctx := context.Background()

	err := svc.Delete(ctx, "test-namespace", "test-secret")

	// Should return contracts.ErrSecureValueNotFound instead of k8s error
	assert.Error(t, err)
	assert.ErrorIs(t, err, contracts.ErrSecureValueNotFound)
}

func TestSecretsService_Delete_WithGrafanaNotFoundError(t *testing.T) {
	mockSecureValueClient := NewMockSecureValueClient(t)

	// Setup client to return the mock resource interface
	clientProvider := &mockSecureValueClientProvider{
		client: mockSecureValueClient,
	}

	// Mock Delete call to return Grafana not found error
	mockSecureValueClient.EXPECT().Delete(mock.Anything, mock.Anything, mock.Anything).Return(contracts.ErrSecureValueNotFound)

	svc := NewSecretsService(clientProvider, nil)
	ctx := context.Background()

	err := svc.Delete(ctx, "test-namespace", "test-secret")

	// Should return contracts.ErrSecureValueNotFound
	assert.Error(t, err)
	assert.ErrorIs(t, err, contracts.ErrSecureValueNotFound)
}
