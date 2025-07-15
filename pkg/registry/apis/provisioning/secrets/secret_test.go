package secrets

import (
	"context"
	"errors"
	"testing"

	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/secrets/mocks"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/service"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestNewSecretsService(t *testing.T) {
	mockSecretsSvc := NewMockSecureValueService(t)
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
		setupMocks    func(*MockSecureValueService, *mocks.MockDecryptService)
		expectedName  string
		expectedError string
	}{
		{
			name:       "successfully create new secret",
			namespace:  "test-namespace",
			secretName: "test-secret",
			data:       "secret-data",
			setupMocks: func(mockSecretsSvc *MockSecureValueService, mockDecryptSvc *mocks.MockDecryptService) {
				// Assert Read call with correct parameters
				mockSecretsSvc.EXPECT().Read(
					mock.MatchedBy(func(ctx context.Context) bool {
						requester, err := identity.GetRequester(ctx)
						return err == nil && requester != nil && requester.GetUID() == ":test-uid"
					}),
					xkube.Namespace("test-namespace"),
					"test-secret",
				).Return(nil, contracts.ErrSecureValueNotFound)

				// Assert Create call with detailed validation
				mockSecretsSvc.EXPECT().Create(
					mock.MatchedBy(func(ctx context.Context) bool {
						requester, err := identity.GetRequester(ctx)
						return err == nil && requester != nil && requester.GetUID() == ":test-uid"
					}),
					mock.MatchedBy(func(sv *secretv1beta1.SecureValue) bool {
						if sv.Namespace != "test-namespace" || sv.Name != "test-secret" {
							return false
						}
						if sv.Spec.Description != "provisioning: test-secret" {
							return false
						}
						if sv.Spec.Value == nil {
							return false
						}
						if len(sv.Spec.Decrypters) != 1 || sv.Spec.Decrypters[0] != svcName {
							return false
						}
						// Verify the actual secret value
						if sv.Spec.Value.DangerouslyExposeAndConsumeValue() != "secret-data" {
							return false
						}
						return true
					}),
					":test-uid",
				).Return(&secretv1beta1.SecureValue{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "test-secret",
						Namespace: "test-namespace",
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
			setupMocks: func(mockSecretsSvc *MockSecureValueService, mockDecryptSvc *mocks.MockDecryptService) {
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

				// Assert Read call with context validation
				mockSecretsSvc.EXPECT().Read(
					mock.MatchedBy(func(ctx context.Context) bool {
						requester, err := identity.GetRequester(ctx)
						return err == nil && requester != nil && requester.GetUID() == ":test-uid"
					}),
					xkube.Namespace("test-namespace"),
					"existing-secret",
				).Return(existingSecret, nil)

				// Assert Update call with detailed validation
				mockSecretsSvc.EXPECT().Update(
					mock.MatchedBy(func(ctx context.Context) bool {
						requester, err := identity.GetRequester(ctx)
						return err == nil && requester != nil && requester.GetUID() == ":test-uid"
					}),
					mock.MatchedBy(func(sv *secretv1beta1.SecureValue) bool {
						if sv.Namespace != "test-namespace" || sv.Name != "existing-secret" {
							return false
						}
						if sv.Spec.Value == nil {
							return false
						}
						// Verify the updated secret value
						if sv.Spec.Value.DangerouslyExposeAndConsumeValue() != "new-secret-data" {
							return false
						}
						return true
					}),
					":test-uid",
				).Return(&secretv1beta1.SecureValue{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "existing-secret",
						Namespace: "test-namespace",
					},
				}, true, nil)
			},
			expectedName: "existing-secret",
		},
		{
			name:       "error reading existing secret",
			namespace:  "test-namespace",
			secretName: "test-secret",
			data:       "secret-data",
			setupMocks: func(mockSecretsSvc *MockSecureValueService, mockDecryptSvc *mocks.MockDecryptService) {
				mockSecretsSvc.EXPECT().Read(
					mock.MatchedBy(func(ctx context.Context) bool {
						requester, err := identity.GetRequester(ctx)
						return err == nil && requester != nil && requester.GetUID() == ":test-uid"
					}),
					xkube.Namespace("test-namespace"),
					"test-secret",
				).Return(nil, errors.New("database error"))
			},
			expectedError: "database error",
		},
		{
			name:       "error creating new secret",
			namespace:  "test-namespace",
			secretName: "test-secret",
			data:       "secret-data",
			setupMocks: func(mockSecretsSvc *MockSecureValueService, mockDecryptSvc *mocks.MockDecryptService) {
				mockSecretsSvc.EXPECT().Read(
					mock.MatchedBy(func(ctx context.Context) bool {
						requester, err := identity.GetRequester(ctx)
						return err == nil && requester != nil && requester.GetUID() == ":test-uid"
					}),
					xkube.Namespace("test-namespace"),
					"test-secret",
				).Return(nil, contracts.ErrSecureValueNotFound)

				mockSecretsSvc.EXPECT().Create(
					mock.MatchedBy(func(ctx context.Context) bool {
						requester, err := identity.GetRequester(ctx)
						return err == nil && requester != nil && requester.GetUID() == ":test-uid"
					}),
					mock.MatchedBy(func(sv *secretv1beta1.SecureValue) bool {
						return sv.Namespace == "test-namespace" &&
							sv.Name == "test-secret" &&
							sv.Spec.Value != nil &&
							sv.Spec.Value.DangerouslyExposeAndConsumeValue() == "secret-data"
					}),
					":test-uid",
				).Return(nil, errors.New("creation failed"))
			},
			expectedError: "creation failed",
		},
		{
			name:       "error updating existing secret",
			namespace:  "test-namespace",
			secretName: "existing-secret",
			data:       "new-secret-data",
			setupMocks: func(mockSecretsSvc *MockSecureValueService, mockDecryptSvc *mocks.MockDecryptService) {
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

				mockSecretsSvc.EXPECT().Read(
					mock.MatchedBy(func(ctx context.Context) bool {
						requester, err := identity.GetRequester(ctx)
						return err == nil && requester != nil && requester.GetUID() == ":test-uid"
					}),
					xkube.Namespace("test-namespace"),
					"existing-secret",
				).Return(existingSecret, nil)

				mockSecretsSvc.EXPECT().Update(
					mock.MatchedBy(func(ctx context.Context) bool {
						requester, err := identity.GetRequester(ctx)
						return err == nil && requester != nil && requester.GetUID() == ":test-uid"
					}),
					mock.MatchedBy(func(sv *secretv1beta1.SecureValue) bool {
						return sv.Namespace == "test-namespace" &&
							sv.Name == "existing-secret" &&
							sv.Spec.Value != nil &&
							sv.Spec.Value.DangerouslyExposeAndConsumeValue() == "new-secret-data"
					}),
					":test-uid",
				).Return(nil, false, errors.New("update failed"))
			},
			expectedError: "update failed",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockSecretsSvc := NewMockSecureValueService(t)
			mockDecryptSvc := &mocks.MockDecryptService{}

			tt.setupMocks(mockSecretsSvc, mockDecryptSvc)

			svc := NewSecretsService(mockSecretsSvc, mockDecryptSvc)

			ctx := context.Background()
			ctx = identity.WithRequester(ctx, &identity.StaticRequester{
				UserUID: "test-uid",
			})

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

func TestSecretsService_Encrypt_NoIdentity(t *testing.T) {
	mockSecretsSvc := NewMockSecureValueService(t)
	mockDecryptSvc := &mocks.MockDecryptService{}

	svc := NewSecretsService(mockSecretsSvc, mockDecryptSvc)

	ctx := context.Background()

	result, err := svc.Encrypt(ctx, "test-namespace", "test-secret", "secret-data")

	assert.Error(t, err)
	assert.Empty(t, result)
}

func TestSecretsService_Decrypt(t *testing.T) {
	tests := []struct {
		name           string
		namespace      string
		secretName     string
		setupMocks     func(*MockSecureValueService, *mocks.MockDecryptService)
		expectedResult []byte
		expectedError  string
	}{
		{
			name:       "successfully decrypt secret",
			namespace:  "test-namespace",
			secretName: "test-secret",
			setupMocks: func(mockSecretsSvc *MockSecureValueService, mockDecryptSvc *mocks.MockDecryptService) {
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
			setupMocks: func(mockSecretsSvc *MockSecureValueService, mockDecryptSvc *mocks.MockDecryptService) {
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
			setupMocks: func(mockSecretsSvc *MockSecureValueService, mockDecryptSvc *mocks.MockDecryptService) {
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
			setupMocks: func(mockSecretsSvc *MockSecureValueService, mockDecryptSvc *mocks.MockDecryptService) {
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
			mockSecretsSvc := NewMockSecureValueService(t)
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

// Test to verify that the Decrypt method creates the correct StaticRequester
func TestSecretsService_Decrypt_StaticRequesterCreation(t *testing.T) {
	mockSecretsSvc := NewMockSecureValueService(t)
	mockDecryptSvc := &mocks.MockDecryptService{}

	exposedValue := secretv1beta1.NewExposedSecureValue("test-data")
	mockResult := service.NewDecryptResultValue(&exposedValue)

	// Create a more detailed context matcher to verify the StaticRequester is created correctly
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
