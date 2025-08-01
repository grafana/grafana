package secrets

import (
	"context"
	"errors"
	"testing"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
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
		nameOrValue    string
		setupMocks     func(*testSetup)
		expectedResult []byte
		expectedError  string
	}{
		{
			name:        "new service success - name starts with repo name",
			namespace:   "test-namespace",
			nameOrValue: "test-repo-secret-name",
			setupMocks: func(s *testSetup) {
				s.mockSecrets.EXPECT().Decrypt(s.ctx, "test-namespace", "test-repo-secret-name").Return([]byte("decrypted-data"), nil)
			},
			expectedResult: []byte("decrypted-data"),
		},
		{
			name:        "new service error - name starts with repo name",
			namespace:   "test-namespace",
			nameOrValue: "test-repo-secret-name",
			setupMocks: func(s *testSetup) {
				s.mockSecrets.EXPECT().Decrypt(s.ctx, "test-namespace", "test-repo-secret-name").Return(nil, errors.New("new service failed"))
			},
			expectedError: "new service failed",
		},
		{
			name:        "legacy service success - name does not start with repo name",
			namespace:   "test-namespace",
			nameOrValue: "legacy-encrypted-value",
			setupMocks: func(s *testSetup) {
				s.mockLegacy.EXPECT().Decrypt(s.ctx, []byte("legacy-encrypted-value")).Return([]byte("decrypted-legacy-data"), nil)
			},
			expectedResult: []byte("decrypted-legacy-data"),
		},
		{
			name:        "legacy service error - name does not start with repo name",
			namespace:   "test-namespace",
			nameOrValue: "legacy-encrypted-value",
			setupMocks: func(s *testSetup) {
				s.mockLegacy.EXPECT().Decrypt(s.ctx, []byte("legacy-encrypted-value")).Return(nil, errors.New("legacy service failed"))
			},
			expectedError: "legacy service failed",
		},
		{
			name:        "new service empty bytes - name starts with repo name",
			namespace:   "test-namespace",
			nameOrValue: "test-repo-secret-name",
			setupMocks: func(s *testSetup) {
				s.mockSecrets.EXPECT().Decrypt(s.ctx, "test-namespace", "test-repo-secret-name").Return([]byte{}, nil)
			},
			expectedResult: []byte{},
		},
		{
			name:        "legacy service empty bytes - name does not start with repo name",
			namespace:   "test-namespace",
			nameOrValue: "legacy-encrypted-value",
			setupMocks: func(s *testSetup) {
				s.mockLegacy.EXPECT().Decrypt(s.ctx, []byte("legacy-encrypted-value")).Return([]byte{}, nil)
			},
			expectedResult: []byte{},
		},
		{
			name:        "custom namespace handling - name starts with repo name",
			namespace:   "custom-namespace",
			nameOrValue: "test-repo-secret-name",
			setupMocks: func(s *testSetup) {
				s.mockSecrets.EXPECT().Decrypt(s.ctx, "custom-namespace", "test-repo-secret-name").Return([]byte("test-data"), nil)
			},
			expectedResult: []byte("test-data"),
		},
		{
			name:        "exact repo name match - should use new service",
			namespace:   "test-namespace",
			nameOrValue: "test-repo",
			setupMocks: func(s *testSetup) {
				s.mockSecrets.EXPECT().Decrypt(s.ctx, "test-namespace", "test-repo").Return([]byte("exact-match-data"), nil)
			},
			expectedResult: []byte("exact-match-data"),
		},
		{
			name:        "partial repo name match - should use legacy service",
			namespace:   "test-namespace",
			nameOrValue: "test-rep",
			setupMocks: func(s *testSetup) {
				s.mockLegacy.EXPECT().Decrypt(s.ctx, []byte("test-rep")).Return([]byte("partial-match-data"), nil)
			},
			expectedResult: []byte("partial-match-data"),
		},
		{
			name:        "empty name - should use legacy service",
			namespace:   "test-namespace",
			nameOrValue: "",
			setupMocks: func(s *testSetup) {
				s.mockLegacy.EXPECT().Decrypt(s.ctx, []byte("")).Return([]byte("empty-name-data"), nil)
			},
			expectedResult: []byte("empty-name-data"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			setup := setupTest(t, tt.namespace)
			tt.setupMocks(setup)

			result, err := setup.rs.Decrypt(setup.ctx, setup.repo, tt.nameOrValue)

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

func TestRepositorySecrets_Delete(t *testing.T) {
	tests := []struct {
		name           string
		namespace      string
		featureEnabled bool
		setupMocks     func(*testSetup)
		expectedError  string
	}{
		{
			name:           "new service delete success",
			namespace:      "test-namespace",
			featureEnabled: true,
			setupMocks: func(s *testSetup) {
				s.expectFeatureFlag(true)
				s.mockSecrets.EXPECT().Delete(s.ctx, "test-namespace", "secret-to-delete").Return(nil)
			},
		},
		{
			name:           "new service delete error",
			namespace:      "test-namespace",
			featureEnabled: true,
			setupMocks: func(s *testSetup) {
				s.expectFeatureFlag(true)
				s.mockSecrets.EXPECT().Delete(s.ctx, "test-namespace", "secret-to-delete").Return(errors.New("delete failed"))
			},
			expectedError: "delete failed",
		},
		{
			name:           "new service secret not found - should succeed",
			namespace:      "test-namespace",
			featureEnabled: true,
			setupMocks: func(s *testSetup) {
				s.expectFeatureFlag(true)
				s.mockSecrets.EXPECT().Delete(s.ctx, "test-namespace", "non-existent-secret").Return(contracts.ErrSecureValueNotFound)
			},
		},
		{
			name:           "nothing for legacy",
			namespace:      "custom-namespace",
			featureEnabled: true,
			setupMocks: func(s *testSetup) {
				s.expectFeatureFlag(false)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			setup := setupTest(t, tt.namespace)
			tt.setupMocks(setup)

			secretName := "secret-to-delete"
			if tt.name == "new service secret not found - should succeed" {
				secretName = "non-existent-secret"
			}
			err := setup.rs.Delete(setup.ctx, setup.repo, secretName)
			if tt.expectedError != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
			} else {
				assert.NoError(t, err)
			}

			setup.mockSecrets.AssertExpectations(t)
		})
	}
}
