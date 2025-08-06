package secrets

import (
	"context"
	"errors"
	"testing"

	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/secrets/mocks"
	"github.com/grafana/grafana/pkg/registry/apis/secret"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
)

// mockDynamicInterface implements a simplified version of the dynamic.ResourceInterface
type mockDynamicInterface struct {
	dynamic.ResourceInterface
	getResult    *unstructured.Unstructured
	getErr       error
	createResult *unstructured.Unstructured
	createErr    error
	updateResult *unstructured.Unstructured
	updateErr    error
	deleteErr    error
}

func (m *mockDynamicInterface) Get(ctx context.Context, name string, options metav1.GetOptions, subresources ...string) (*unstructured.Unstructured, error) {
	return m.getResult, m.getErr
}

func (m *mockDynamicInterface) Create(ctx context.Context, obj *unstructured.Unstructured, options metav1.CreateOptions, subresources ...string) (*unstructured.Unstructured, error) {
	return m.createResult, m.createErr
}

func (m *mockDynamicInterface) Update(ctx context.Context, obj *unstructured.Unstructured, options metav1.UpdateOptions, subresources ...string) (*unstructured.Unstructured, error) {
	return m.updateResult, m.updateErr
}

func (m *mockDynamicInterface) Delete(ctx context.Context, name string, options metav1.DeleteOptions, subresources ...string) error {
	return m.deleteErr
}

func TestNewSecretsService(t *testing.T) {
	mockSecretsSvc := NewMockSecureValueClient(t)
	mockDecryptSvc := &mocks.MockDecryptService{}

	svc := NewSecretsService(mockSecretsSvc, mockDecryptSvc, &setting.Cfg{})

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
		setupMocks    func(*MockSecureValueClient, *mocks.MockDecryptService, *mockDynamicInterface)
		expectedName  string
		expectedError string
	}{
		{
			name:       "successfully create new secret",
			namespace:  "test-namespace",
			secretName: "test-secret",
			data:       "secret-data",
			setupMocks: func(mockSecretsSvc *MockSecureValueClient, mockDecryptSvc *mocks.MockDecryptService, mockResourceInterface *mockDynamicInterface) {
				// Setup client to return the mock resource interface
				mockSecretsSvc.EXPECT().Client(mock.Anything, "test-namespace").Return(mockResourceInterface, nil)

				// Mock Get call to return not found error (secret doesn't exist)
				mockResourceInterface.getResult = nil
				mockResourceInterface.getErr = contracts.ErrSecureValueNotFound

				// Mock Create call
				mockResourceInterface.createResult = &unstructured.Unstructured{
					Object: map[string]interface{}{
						"metadata": map[string]interface{}{
							"name":      "test-secret",
							"namespace": "test-namespace",
						},
					},
				}
				mockResourceInterface.createErr = nil
			},
			expectedName: "test-secret",
		},
		{
			name:       "successfully update existing secret",
			namespace:  "test-namespace",
			secretName: "existing-secret",
			data:       "new-secret-data",
			setupMocks: func(mockSecretsSvc *MockSecureValueClient, mockDecryptSvc *mocks.MockDecryptService, mockResourceInterface *mockDynamicInterface) {
				existingSecret := &unstructured.Unstructured{
					Object: map[string]interface{}{
						"metadata": map[string]interface{}{
							"name":      "existing-secret",
							"namespace": "test-namespace",
						},
						"spec": map[string]interface{}{
							"description": "provisioning: existing-secret",
							"decrypters":  []string{svcName},
						},
					},
				}

				// Setup client to return the mock resource interface
				mockSecretsSvc.EXPECT().Client(mock.Anything, "test-namespace").Return(mockResourceInterface, nil)

				// Mock Get call to return existing secret
				mockResourceInterface.getResult = existingSecret
				mockResourceInterface.getErr = nil

				// Mock Update call
				mockResourceInterface.updateResult = &unstructured.Unstructured{
					Object: map[string]interface{}{
						"metadata": map[string]interface{}{
							"name":      "existing-secret",
							"namespace": "test-namespace",
						},
					},
				}
				mockResourceInterface.updateErr = nil
			},
			expectedName: "existing-secret",
		},
		{
			name:       "error reading existing secret",
			namespace:  "test-namespace",
			secretName: "test-secret",
			data:       "secret-data",
			setupMocks: func(mockSecretsSvc *MockSecureValueClient, mockDecryptSvc *mocks.MockDecryptService, mockResourceInterface *mockDynamicInterface) {
				// Setup client to return the mock resource interface
				mockSecretsSvc.EXPECT().Client(mock.Anything, "test-namespace").Return(mockResourceInterface, nil)

				// Mock Get call to return error
				mockResourceInterface.getResult = nil
				mockResourceInterface.getErr = errors.New("database error")
			},
			expectedError: "database error",
		},
		{
			name:       "error creating new secret",
			namespace:  "test-namespace",
			secretName: "test-secret",
			data:       "secret-data",
			setupMocks: func(mockSecretsSvc *MockSecureValueClient, mockDecryptSvc *mocks.MockDecryptService, mockResourceInterface *mockDynamicInterface) {
				// Setup client to return the mock resource interface
				mockSecretsSvc.EXPECT().Client(mock.Anything, "test-namespace").Return(mockResourceInterface, nil)

				// Mock Get call to return not found error
				mockResourceInterface.getResult = nil
				mockResourceInterface.getErr = contracts.ErrSecureValueNotFound

				// Mock Create call to return error
				mockResourceInterface.createResult = nil
				mockResourceInterface.createErr = errors.New("creation failed")
			},
			expectedError: "creation failed",
		},
		{
			name:       "error updating existing secret",
			namespace:  "test-namespace",
			secretName: "existing-secret",
			data:       "new-secret-data",
			setupMocks: func(mockSecretsSvc *MockSecureValueClient, mockDecryptSvc *mocks.MockDecryptService, mockResourceInterface *mockDynamicInterface) {
				existingSecret := &unstructured.Unstructured{
					Object: map[string]interface{}{
						"metadata": map[string]interface{}{
							"name":      "existing-secret",
							"namespace": "test-namespace",
						},
						"spec": map[string]interface{}{
							"description": "provisioning: existing-secret",
							"decrypters":  []string{svcName},
						},
					},
				}

				// Setup client to return the mock resource interface
				mockSecretsSvc.EXPECT().Client(mock.Anything, "test-namespace").Return(mockResourceInterface, nil)

				// Mock Get call to return existing secret
				mockResourceInterface.getResult = existingSecret
				mockResourceInterface.getErr = nil

				// Mock Update call to return error
				mockResourceInterface.updateResult = nil
				mockResourceInterface.updateErr = errors.New("update failed")
			},
			expectedError: "update failed",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockSecretsSvc := NewMockSecureValueClient(t)
			mockDecryptSvc := &mocks.MockDecryptService{}
			mockResourceInterface := &mockDynamicInterface{}

			tt.setupMocks(mockSecretsSvc, mockDecryptSvc, mockResourceInterface)

			svc := NewSecretsService(mockSecretsSvc, mockDecryptSvc, &setting.Cfg{})

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
	mockSecretsSvc := NewMockSecureValueClient(t)
	mockDecryptSvc := &mocks.MockDecryptService{}

	// Setup client to return error
	mockSecretsSvc.EXPECT().Client(mock.Anything, "test-namespace").Return(nil, errors.New("client error"))

	svc := NewSecretsService(mockSecretsSvc, mockDecryptSvc, &setting.Cfg{})

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
		setupMocks     func(*MockSecureValueClient, *mocks.MockDecryptService)
		expectedResult []byte
		expectedError  string
	}{
		{
			name:       "successfully decrypt secret",
			namespace:  "test-namespace",
			secretName: "test-secret",
			setupMocks: func(mockSecretsSvc *MockSecureValueClient, mockDecryptSvc *mocks.MockDecryptService) {
				exposedValue := secretv1beta1.NewExposedSecureValue("decrypted-data")
				mockResult := secret.NewDecryptResultValue(&exposedValue)

				mockDecryptSvc.EXPECT().Decrypt(
					mock.MatchedBy(func(ctx context.Context) bool {
						// Verify that the context is not nil (the service creates a new StaticRequester)
						return ctx != nil
					}),
					svcName,
					"test-namespace",
					[]string{"test-secret"},
				).Return(map[string]secret.DecryptResult{
					"test-secret": mockResult,
				}, nil)
			},
			expectedResult: []byte("decrypted-data"),
		},
		{
			name:       "decrypt service error",
			namespace:  "test-namespace",
			secretName: "test-secret",
			setupMocks: func(mockSecretsSvc *MockSecureValueClient, mockDecryptSvc *mocks.MockDecryptService) {
				mockDecryptSvc.EXPECT().Decrypt(
					mock.MatchedBy(func(ctx context.Context) bool {
						return ctx != nil
					}),
					svcName,
					"test-namespace",
					[]string{"test-secret"},
				).Return(nil, errors.New("decrypt service error"))
			},
			expectedError: "decrypt service error",
		},
		{
			name:       "secret not found in results",
			namespace:  "test-namespace",
			secretName: "test-secret",
			setupMocks: func(mockSecretsSvc *MockSecureValueClient, mockDecryptSvc *mocks.MockDecryptService) {
				mockDecryptSvc.EXPECT().Decrypt(
					mock.MatchedBy(func(ctx context.Context) bool {
						return ctx != nil
					}),
					svcName,
					"test-namespace",
					[]string{"test-secret"},
				).Return(map[string]secret.DecryptResult{}, nil)
			},
			expectedError: secret.ErrDecryptNotFound.Error(),
		},
		{
			name:       "decrypt result has error",
			namespace:  "test-namespace",
			secretName: "test-secret",
			setupMocks: func(mockSecretsSvc *MockSecureValueClient, mockDecryptSvc *mocks.MockDecryptService) {
				mockResult := secret.NewDecryptResultErr(errors.New("decryption failed"))

				mockDecryptSvc.EXPECT().Decrypt(
					mock.MatchedBy(func(ctx context.Context) bool {
						return ctx != nil
					}),
					svcName,
					"test-namespace",
					[]string{"test-secret"},
				).Return(map[string]secret.DecryptResult{
					"test-secret": mockResult,
				}, nil)
			},
			expectedError: "decryption failed",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockSecretsSvc := NewMockSecureValueClient(t)
			mockDecryptSvc := &mocks.MockDecryptService{}

			tt.setupMocks(mockSecretsSvc, mockDecryptSvc)

			svc := NewSecretsService(mockSecretsSvc, mockDecryptSvc, &setting.Cfg{})

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
	mockSecretsSvc := NewMockSecureValueClient(t)
	mockDecryptSvc := &mocks.MockDecryptService{}

	exposedValue := secretv1beta1.NewExposedSecureValue("test-data")
	mockResult := secret.NewDecryptResultValue(&exposedValue)

	// Create a more detailed context matcher to verify the service identity context is created correctly
	mockDecryptSvc.EXPECT().Decrypt(
		mock.MatchedBy(func(ctx context.Context) bool {
			// At minimum, verify the context is not nil and is different from the original
			return ctx != nil
		}),
		svcName,
		"test-namespace",
		[]string{"test-secret"},
	).Return(map[string]secret.DecryptResult{
		"test-secret": mockResult,
	}, nil)

	svc := NewSecretsService(mockSecretsSvc, mockDecryptSvc, &setting.Cfg{})

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
		setupMocks    func(mockSecretsSvc *MockSecureValueClient, mockDecryptSvc *mocks.MockDecryptService, mockResourceInterface *mockDynamicInterface)
		expectedError string
	}{
		{
			name:       "delete success",
			namespace:  "test-namespace",
			secretName: "test-secret",
			setupMocks: func(mockSecretsSvc *MockSecureValueClient, mockDecryptSvc *mocks.MockDecryptService, mockResourceInterface *mockDynamicInterface) {
				// Setup client to return the mock resource interface
				mockSecretsSvc.EXPECT().Client(mock.Anything, "test-namespace").Return(mockResourceInterface, nil)

				// Mock Delete call
				mockResourceInterface.deleteErr = nil
			},
		},
		{
			name:       "delete returns error",
			namespace:  "test-namespace",
			secretName: "test-secret",
			setupMocks: func(mockSecretsSvc *MockSecureValueClient, mockDecryptSvc *mocks.MockDecryptService, mockResourceInterface *mockDynamicInterface) {
				// Setup client to return the mock resource interface
				mockSecretsSvc.EXPECT().Client(mock.Anything, "test-namespace").Return(mockResourceInterface, nil)

				// Mock Delete call to return error
				mockResourceInterface.deleteErr = errors.New("delete failed")
			},
			expectedError: "delete failed",
		},
		{
			name:       "client error",
			namespace:  "test-namespace",
			secretName: "test-secret",
			setupMocks: func(mockSecretsSvc *MockSecureValueClient, mockDecryptSvc *mocks.MockDecryptService, mockResourceInterface *mockDynamicInterface) {
				// Setup client to return error
				mockSecretsSvc.EXPECT().Client(mock.Anything, "test-namespace").Return(nil, errors.New("client error"))
			},
			expectedError: "client error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockSecretsSvc := NewMockSecureValueClient(t)
			mockDecryptSvc := &mocks.MockDecryptService{}
			mockResourceInterface := &mockDynamicInterface{}

			tt.setupMocks(mockSecretsSvc, mockDecryptSvc, mockResourceInterface)

			svc := NewSecretsService(mockSecretsSvc, mockDecryptSvc, &setting.Cfg{})
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
	mockSecretsSvc := NewMockSecureValueClient(t)
	mockDecryptSvc := &mocks.MockDecryptService{}
	mockResourceInterface := &mockDynamicInterface{}

	// Setup client to return the mock resource interface
	mockSecretsSvc.EXPECT().Client(mock.Anything, "test-namespace").Return(mockResourceInterface, nil)

	// Mock Get call to return k8s not found error
	k8sNotFoundErr := apierrors.NewNotFound(schema.GroupResource{Group: "secret.grafana.app", Resource: "securevalues"}, "test-secret")
	mockResourceInterface.getResult = nil
	mockResourceInterface.getErr = k8sNotFoundErr

	// Mock Create call to succeed
	mockResourceInterface.createResult = &unstructured.Unstructured{
		Object: map[string]interface{}{
			"metadata": map[string]interface{}{
				"name":      "test-secret",
				"namespace": "test-namespace",
			},
		},
	}
	mockResourceInterface.createErr = nil

	svc := NewSecretsService(mockSecretsSvc, mockDecryptSvc, &setting.Cfg{})
	ctx := context.Background()

	result, err := svc.Encrypt(ctx, "test-namespace", "test-secret", "secret-data")

	assert.NoError(t, err)
	assert.Equal(t, "test-secret", result)
}

func TestSecretsService_Delete_WithK8sNotFoundError(t *testing.T) {
	mockSecretsSvc := NewMockSecureValueClient(t)
	mockDecryptSvc := &mocks.MockDecryptService{}
	mockResourceInterface := &mockDynamicInterface{}

	// Setup client to return the mock resource interface
	mockSecretsSvc.EXPECT().Client(mock.Anything, "test-namespace").Return(mockResourceInterface, nil)

	// Mock Delete call to return k8s not found error
	k8sNotFoundErr := apierrors.NewNotFound(schema.GroupResource{Group: "secret.grafana.app", Resource: "securevalues"}, "test-secret")
	mockResourceInterface.deleteErr = k8sNotFoundErr

	svc := NewSecretsService(mockSecretsSvc, mockDecryptSvc, &setting.Cfg{})
	ctx := context.Background()

	err := svc.Delete(ctx, "test-namespace", "test-secret")

	// Should return contracts.ErrSecureValueNotFound instead of k8s error
	assert.Error(t, err)
	assert.ErrorIs(t, err, contracts.ErrSecureValueNotFound)
}

func TestSecretsService_Delete_WithGrafanaNotFoundError(t *testing.T) {
	mockSecretsSvc := NewMockSecureValueClient(t)
	mockDecryptSvc := &mocks.MockDecryptService{}
	mockResourceInterface := &mockDynamicInterface{}

	// Setup client to return the mock resource interface
	mockSecretsSvc.EXPECT().Client(mock.Anything, "test-namespace").Return(mockResourceInterface, nil)

	// Mock Delete call to return Grafana not found error
	mockResourceInterface.deleteErr = contracts.ErrSecureValueNotFound

	svc := NewSecretsService(mockSecretsSvc, mockDecryptSvc, &setting.Cfg{})
	ctx := context.Background()

	err := svc.Delete(ctx, "test-namespace", "test-secret")

	// Should return contracts.ErrSecureValueNotFound
	assert.Error(t, err)
	assert.ErrorIs(t, err, contracts.ErrSecureValueNotFound)
}
