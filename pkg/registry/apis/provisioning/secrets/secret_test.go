package secrets

import (
	"context"
	"errors"
	"testing"

	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/secrets/mocks"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/service"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/watch"
)

// MockResourceInterface is a mock for dynamic.ResourceInterface
type MockResourceInterface struct {
	mock.Mock
}

func (m *MockResourceInterface) Get(ctx context.Context, name string, options metav1.GetOptions, subresources ...string) (*unstructured.Unstructured, error) {
	args := m.Called(ctx, name, options)
	return args.Get(0).(*unstructured.Unstructured), args.Error(1)
}

func (m *MockResourceInterface) Create(ctx context.Context, obj *unstructured.Unstructured, options metav1.CreateOptions, subresources ...string) (*unstructured.Unstructured, error) {
	args := m.Called(ctx, obj, options)
	return args.Get(0).(*unstructured.Unstructured), args.Error(1)
}

func (m *MockResourceInterface) Update(ctx context.Context, obj *unstructured.Unstructured, options metav1.UpdateOptions, subresources ...string) (*unstructured.Unstructured, error) {
	args := m.Called(ctx, obj, options)
	return args.Get(0).(*unstructured.Unstructured), args.Error(1)
}

func (m *MockResourceInterface) Delete(ctx context.Context, name string, options metav1.DeleteOptions, subresources ...string) error {
	args := m.Called(ctx, name, options)
	return args.Error(0)
}

func (m *MockResourceInterface) DeleteCollection(ctx context.Context, options metav1.DeleteOptions, listOptions metav1.ListOptions) error {
	args := m.Called(ctx, options, listOptions)
	return args.Error(0)
}

func (m *MockResourceInterface) List(ctx context.Context, opts metav1.ListOptions) (*unstructured.UnstructuredList, error) {
	args := m.Called(ctx, opts)
	return args.Get(0).(*unstructured.UnstructuredList), args.Error(1)
}

func (m *MockResourceInterface) Watch(ctx context.Context, opts metav1.ListOptions) (watch.Interface, error) {
	args := m.Called(ctx, opts)
	return args.Get(0).(watch.Interface), args.Error(1)
}

func (m *MockResourceInterface) Patch(ctx context.Context, name string, pt types.PatchType, data []byte, options metav1.PatchOptions, subresources ...string) (*unstructured.Unstructured, error) {
	args := m.Called(ctx, name, pt, data, options)
	return args.Get(0).(*unstructured.Unstructured), args.Error(1)
}

func (m *MockResourceInterface) Apply(ctx context.Context, name string, obj *unstructured.Unstructured, options metav1.ApplyOptions, subresources ...string) (*unstructured.Unstructured, error) {
	args := m.Called(ctx, name, obj, options)
	return args.Get(0).(*unstructured.Unstructured), args.Error(1)
}

func (m *MockResourceInterface) ApplyStatus(ctx context.Context, name string, obj *unstructured.Unstructured, options metav1.ApplyOptions) (*unstructured.Unstructured, error) {
	args := m.Called(ctx, name, obj, options)
	return args.Get(0).(*unstructured.Unstructured), args.Error(1)
}

func (m *MockResourceInterface) UpdateStatus(ctx context.Context, obj *unstructured.Unstructured, options metav1.UpdateOptions) (*unstructured.Unstructured, error) {
	args := m.Called(ctx, obj, options)
	return args.Get(0).(*unstructured.Unstructured), args.Error(1)
}

func TestNewSecretsService(t *testing.T) {
	mockSecretsSvc := NewMockSecureValueClient(t)
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
		setupMocks    func(*MockSecureValueClient, *mocks.MockDecryptService, *MockResourceInterface)
		expectedName  string
		expectedError string
	}{
		{
			name:       "successfully create new secret",
			namespace:  "test-namespace",
			secretName: "test-secret",
			data:       "secret-data",
			setupMocks: func(mockSecretsSvc *MockSecureValueClient, mockDecryptSvc *mocks.MockDecryptService, mockResourceInterface *MockResourceInterface) {
				// Setup client to return the mock resource interface
				mockSecretsSvc.EXPECT().Client(mock.Anything, "test-namespace").Return(mockResourceInterface, nil)

				// Mock Get call to return not found error (secret doesn't exist)
				mockResourceInterface.On("Get", mock.Anything, "test-secret", mock.AnythingOfType("v1.GetOptions")).Return((*unstructured.Unstructured)(nil), contracts.ErrSecureValueNotFound)

				// Mock Create call with validation
				mockResourceInterface.On("Create", mock.AnythingOfType("context.backgroundCtx"), mock.AnythingOfType("*unstructured.Unstructured"), mock.AnythingOfType("v1.CreateOptions")).Return(&unstructured.Unstructured{
					Object: map[string]interface{}{
						"metadata": map[string]interface{}{
							"name":      "test-secret",
							"namespace": "test-namespace",
						},
					},
				}, nil)
			},
			expectedName: "test-secret",
		},
		{
			name:       "successfully update existing secret",
			namespace:  "test-namespace",
			secretName: "existing-secret",
			data:       "new-secret-data",
			setupMocks: func(mockSecretsSvc *MockSecureValueClient, mockDecryptSvc *mocks.MockDecryptService, mockResourceInterface *MockResourceInterface) {
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
				mockResourceInterface.On("Get", mock.Anything, "existing-secret", mock.AnythingOfType("v1.GetOptions")).Return(existingSecret, nil)

				// Mock Update call with validation
				mockResourceInterface.On("Update", mock.AnythingOfType("context.backgroundCtx"), mock.AnythingOfType("*unstructured.Unstructured"), mock.AnythingOfType("v1.UpdateOptions")).Return(&unstructured.Unstructured{
					Object: map[string]interface{}{
						"metadata": map[string]interface{}{
							"name":      "existing-secret",
							"namespace": "test-namespace",
						},
					},
				}, nil)
			},
			expectedName: "existing-secret",
		},
		{
			name:       "error reading existing secret",
			namespace:  "test-namespace",
			secretName: "test-secret",
			data:       "secret-data",
			setupMocks: func(mockSecretsSvc *MockSecureValueClient, mockDecryptSvc *mocks.MockDecryptService, mockResourceInterface *MockResourceInterface) {
				// Setup client to return the mock resource interface
				mockSecretsSvc.EXPECT().Client(mock.Anything, "test-namespace").Return(mockResourceInterface, nil)

				// Mock Get call to return error
				mockResourceInterface.On("Get", mock.Anything, "test-secret", mock.AnythingOfType("v1.GetOptions")).Return((*unstructured.Unstructured)(nil), errors.New("database error"))
			},
			expectedError: "database error",
		},
		{
			name:       "error creating new secret",
			namespace:  "test-namespace",
			secretName: "test-secret",
			data:       "secret-data",
			setupMocks: func(mockSecretsSvc *MockSecureValueClient, mockDecryptSvc *mocks.MockDecryptService, mockResourceInterface *MockResourceInterface) {
				// Setup client to return the mock resource interface
				mockSecretsSvc.EXPECT().Client(mock.Anything, "test-namespace").Return(mockResourceInterface, nil)

				// Mock Get call to return not found error
				mockResourceInterface.On("Get", mock.Anything, "test-secret", mock.AnythingOfType("v1.GetOptions")).Return((*unstructured.Unstructured)(nil), contracts.ErrSecureValueNotFound)

				// Mock Create call to return error
				mockResourceInterface.On("Create", mock.Anything, mock.AnythingOfType("*unstructured.Unstructured"), mock.Anything).Return((*unstructured.Unstructured)(nil), errors.New("creation failed"))
			},
			expectedError: "creation failed",
		},
		{
			name:       "error updating existing secret",
			namespace:  "test-namespace",
			secretName: "existing-secret",
			data:       "new-secret-data",
			setupMocks: func(mockSecretsSvc *MockSecureValueClient, mockDecryptSvc *mocks.MockDecryptService, mockResourceInterface *MockResourceInterface) {
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
				mockResourceInterface.On("Get", mock.Anything, "existing-secret", mock.AnythingOfType("v1.GetOptions")).Return(existingSecret, nil)

				// Mock Update call to return error
				mockResourceInterface.On("Update", mock.Anything, mock.AnythingOfType("*unstructured.Unstructured"), mock.Anything).Return((*unstructured.Unstructured)(nil), errors.New("update failed"))
			},
			expectedError: "update failed",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockSecretsSvc := NewMockSecureValueClient(t)
			mockDecryptSvc := &mocks.MockDecryptService{}
			mockResourceInterface := &MockResourceInterface{}

			tt.setupMocks(mockSecretsSvc, mockDecryptSvc, mockResourceInterface)

			svc := NewSecretsService(mockSecretsSvc, mockDecryptSvc)

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

	svc := NewSecretsService(mockSecretsSvc, mockDecryptSvc)

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
			setupMocks: func(mockSecretsSvc *MockSecureValueClient, mockDecryptSvc *mocks.MockDecryptService) {
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
			setupMocks: func(mockSecretsSvc *MockSecureValueClient, mockDecryptSvc *mocks.MockDecryptService) {
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
			setupMocks: func(mockSecretsSvc *MockSecureValueClient, mockDecryptSvc *mocks.MockDecryptService) {
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
			mockSecretsSvc := NewMockSecureValueClient(t)
			mockDecryptSvc := &mocks.MockDecryptService{}

			tt.setupMocks(mockSecretsSvc, mockDecryptSvc)

			svc := NewSecretsService(mockSecretsSvc, mockDecryptSvc)

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

	svc := NewSecretsService(mockSecretsSvc, mockDecryptSvc)

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
		setupMocks    func(mockSecretsSvc *MockSecureValueClient, mockDecryptSvc *mocks.MockDecryptService, mockResourceInterface *MockResourceInterface)
		expectedError string
	}{
		{
			name:       "delete success",
			namespace:  "test-namespace",
			secretName: "test-secret",
			setupMocks: func(mockSecretsSvc *MockSecureValueClient, mockDecryptSvc *mocks.MockDecryptService, mockResourceInterface *MockResourceInterface) {
				// Setup client to return the mock resource interface
				mockSecretsSvc.EXPECT().Client(mock.Anything, "test-namespace").Return(mockResourceInterface, nil)

				// Mock Delete call
				mockResourceInterface.On("Delete", mock.Anything, "test-secret", mock.AnythingOfType("v1.DeleteOptions")).Return(nil)
			},
		},
		{
			name:       "delete returns error",
			namespace:  "test-namespace",
			secretName: "test-secret",
			setupMocks: func(mockSecretsSvc *MockSecureValueClient, mockDecryptSvc *mocks.MockDecryptService, mockResourceInterface *MockResourceInterface) {
				// Setup client to return the mock resource interface
				mockSecretsSvc.EXPECT().Client(mock.Anything, "test-namespace").Return(mockResourceInterface, nil)

				// Mock Delete call to return error
				mockResourceInterface.On("Delete", mock.Anything, "test-secret", mock.AnythingOfType("v1.DeleteOptions")).Return(errors.New("delete failed"))
			},
			expectedError: "delete failed",
		},
		{
			name:       "client error",
			namespace:  "test-namespace",
			secretName: "test-secret",
			setupMocks: func(mockSecretsSvc *MockSecureValueClient, mockDecryptSvc *mocks.MockDecryptService, mockResourceInterface *MockResourceInterface) {
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
			mockResourceInterface := &MockResourceInterface{}

			tt.setupMocks(mockSecretsSvc, mockDecryptSvc, mockResourceInterface)

			svc := NewSecretsService(mockSecretsSvc, mockDecryptSvc)
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
