package secrets

import (
	"context"
	"errors"
	"testing"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type testSetup struct {
	rs           RepositorySecrets
	mockFeatures *featuremgmt.MockFeatureToggles
	mockSecrets  *MockService
	mockLegacy   *MockLegacyService
	repo         *provisioning.Repository
	ctx          context.Context
}

func setupTest(t *testing.T, namespace string) *testSetup {
	mockFeatures := featuremgmt.NewMockFeatureToggles(t)
	mockSecrets := NewMockService(t)
	mockLegacy := NewMockLegacyService(t)

	rs := NewRepositorySecrets(mockFeatures, mockSecrets, mockLegacy)

	repo := &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-repo",
			Namespace: namespace,
		},
	}

	return &testSetup{
		rs:           rs,
		mockFeatures: mockFeatures,
		mockSecrets:  mockSecrets,
		mockLegacy:   mockLegacy,
		repo:         repo,
		ctx:          context.Background(),
	}
}

func (s *testSetup) expectFeatureFlag(enabled bool) {
	s.mockFeatures.EXPECT().IsEnabled(
		mock.AnythingOfType("context.backgroundCtx"),
		featuremgmt.FlagProvisioningSecretsService,
	).Return(enabled)
}

func TestRepositorySecrets_Encrypt(t *testing.T) {
	tests := []struct {
		name           string
		namespace      string
		featureEnabled bool
		setupMocks     func(*testSetup)
		expectedResult []byte
		expectedError  string
	}{
		{
			name:           "new service success",
			namespace:      "test-namespace",
			featureEnabled: true,
			setupMocks: func(s *testSetup) {
				s.expectFeatureFlag(true)
				s.mockSecrets.EXPECT().Encrypt(s.ctx, "test-namespace", "test-secret", "secret-data").Return("encrypted-name", nil)
			},
			expectedResult: []byte("encrypted-name"),
		},
		{
			name:           "legacy service success",
			namespace:      "test-namespace",
			featureEnabled: false,
			setupMocks: func(s *testSetup) {
				s.expectFeatureFlag(false)
				s.mockLegacy.EXPECT().Encrypt(s.ctx, []byte("secret-data")).Return([]byte("encrypted-legacy-data"), nil)
			},
			expectedResult: []byte("encrypted-legacy-data"),
		},
		{
			name:           "new service error",
			namespace:      "test-namespace",
			featureEnabled: true,
			setupMocks: func(s *testSetup) {
				s.expectFeatureFlag(true)
				s.mockSecrets.EXPECT().Encrypt(s.ctx, "test-namespace", "test-secret", "secret-data").Return("", errors.New("encryption failed"))
			},
			expectedError: "encryption failed",
		},
		{
			name:           "legacy service error",
			namespace:      "test-namespace",
			featureEnabled: false,
			setupMocks: func(s *testSetup) {
				s.expectFeatureFlag(false)
				s.mockLegacy.EXPECT().Encrypt(s.ctx, []byte("secret-data")).Return(nil, errors.New("legacy encryption failed"))
			},
			expectedError: "legacy encryption failed",
		},
		{
			name:           "empty namespace handling",
			namespace:      "",
			featureEnabled: true,
			setupMocks: func(s *testSetup) {
				s.expectFeatureFlag(true)
				s.mockSecrets.EXPECT().Encrypt(s.ctx, "", "test-secret", "secret-data").Return("encrypted", nil)
			},
			expectedResult: []byte("encrypted"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			setup := setupTest(t, tt.namespace)
			tt.setupMocks(setup)

			result, err := setup.rs.Encrypt(setup.ctx, setup.repo, "test-secret", "secret-data")

			if tt.expectedError != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
				assert.Nil(t, result)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedResult, result)
			}
		})
	}
}

func TestRepositorySecrets_Decrypt(t *testing.T) {
	tests := []struct {
		name           string
		namespace      string
		featureEnabled bool
		setupMocks     func(*testSetup)
		expectedResult []byte
		expectedError  string
	}{
		{
			name:           "new service success",
			namespace:      "test-namespace",
			featureEnabled: true,
			setupMocks: func(s *testSetup) {
				s.expectFeatureFlag(true)
				s.mockSecrets.EXPECT().Decrypt(s.ctx, "test-namespace", "encrypted-value").Return([]byte("decrypted-data"), nil)
			},
			expectedResult: []byte("decrypted-data"),
		},
		{
			name:           "legacy service success",
			namespace:      "test-namespace",
			featureEnabled: false,
			setupMocks: func(s *testSetup) {
				s.expectFeatureFlag(false)
				s.mockLegacy.EXPECT().Decrypt(s.ctx, []byte("encrypted-value")).Return([]byte("decrypted-legacy-data"), nil)
			},
			expectedResult: []byte("decrypted-legacy-data"),
		},
		{
			name:           "new service fails, fallback to legacy succeeds",
			namespace:      "test-namespace",
			featureEnabled: true,
			setupMocks: func(s *testSetup) {
				s.expectFeatureFlag(true)
				s.mockSecrets.EXPECT().Decrypt(s.ctx, "test-namespace", "encrypted-value").Return(nil, errors.New("new service failed"))
				s.mockLegacy.EXPECT().Decrypt(s.ctx, []byte("encrypted-value")).Return([]byte("decrypted-fallback-data"), nil)
			},
			expectedResult: []byte("decrypted-fallback-data"),
		},
		{
			name:           "legacy service fails, fallback to new succeeds",
			namespace:      "test-namespace",
			featureEnabled: false,
			setupMocks: func(s *testSetup) {
				s.expectFeatureFlag(false)
				s.mockLegacy.EXPECT().Decrypt(s.ctx, []byte("encrypted-value")).Return(nil, errors.New("legacy service failed"))
				s.mockSecrets.EXPECT().Decrypt(s.ctx, "test-namespace", "encrypted-value").Return([]byte("decrypted-new-data"), nil)
			},
			expectedResult: []byte("decrypted-new-data"),
		},
		{
			name:           "both services fail (feature flag enabled)",
			namespace:      "test-namespace",
			featureEnabled: true,
			setupMocks: func(s *testSetup) {
				s.expectFeatureFlag(true)
				s.mockSecrets.EXPECT().Decrypt(s.ctx, "test-namespace", "encrypted-value").Return(nil, errors.New("new service failed"))
				s.mockLegacy.EXPECT().Decrypt(s.ctx, []byte("encrypted-value")).Return(nil, errors.New("legacy service failed"))
			},
			expectedError: "legacy service failed",
		},
		{
			name:           "both services fail (feature flag disabled)",
			namespace:      "test-namespace",
			featureEnabled: false,
			setupMocks: func(s *testSetup) {
				s.expectFeatureFlag(false)
				s.mockLegacy.EXPECT().Decrypt(s.ctx, []byte("encrypted-value")).Return(nil, errors.New("legacy service failed"))
				s.mockSecrets.EXPECT().Decrypt(s.ctx, "test-namespace", "encrypted-value").Return(nil, errors.New("new service failed"))
			},
			expectedError: "new service failed",
		},
		{
			name:           "custom namespace handling",
			namespace:      "custom-namespace",
			featureEnabled: true,
			setupMocks: func(s *testSetup) {
				s.expectFeatureFlag(true)
				s.mockSecrets.EXPECT().Decrypt(s.ctx, "custom-namespace", "encrypted-value").Return([]byte("test-data"), nil)
			},
			expectedResult: []byte("test-data"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			setup := setupTest(t, tt.namespace)
			tt.setupMocks(setup)

			result, err := setup.rs.Decrypt(setup.ctx, setup.repo, "encrypted-value")

			if tt.expectedError != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
				assert.Nil(t, result)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedResult, result)
			}
		})
	}
}
