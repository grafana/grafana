package scimutil

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/services/apiserver/client"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// MockK8sHandler is a mock implementation of client.K8sHandler for testing
type MockK8sHandler struct {
	mock.Mock
}

func (m *MockK8sHandler) GetNamespace(orgID int64) string {
	args := m.Called(orgID)
	return args.String(0)
}

func (m *MockK8sHandler) Get(ctx context.Context, name string, orgID int64, opts metav1.GetOptions, subresource ...string) (*unstructured.Unstructured, error) {
	args := m.Called(ctx, name, orgID, opts, subresource)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*unstructured.Unstructured), args.Error(1)
}

func (m *MockK8sHandler) Create(ctx context.Context, obj *unstructured.Unstructured, orgID int64, opts metav1.CreateOptions) (*unstructured.Unstructured, error) {
	args := m.Called(ctx, obj, orgID, opts)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*unstructured.Unstructured), args.Error(1)
}

func (m *MockK8sHandler) Update(ctx context.Context, obj *unstructured.Unstructured, orgID int64, opts metav1.UpdateOptions) (*unstructured.Unstructured, error) {
	args := m.Called(ctx, obj, orgID, opts)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*unstructured.Unstructured), args.Error(1)
}

func (m *MockK8sHandler) Delete(ctx context.Context, name string, orgID int64, options metav1.DeleteOptions) error {
	args := m.Called(ctx, name, orgID, options)
	return args.Error(0)
}

func (m *MockK8sHandler) DeleteCollection(ctx context.Context, orgID int64) error {
	args := m.Called(ctx, orgID)
	return args.Error(0)
}

func (m *MockK8sHandler) List(ctx context.Context, orgID int64, options metav1.ListOptions) (*unstructured.UnstructuredList, error) {
	args := m.Called(ctx, orgID, options)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*unstructured.UnstructuredList), args.Error(1)
}

func (m *MockK8sHandler) Search(ctx context.Context, orgID int64, in *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
	args := m.Called(ctx, orgID, in)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*resourcepb.ResourceSearchResponse), args.Error(1)
}

func (m *MockK8sHandler) GetStats(ctx context.Context, orgID int64) (*resourcepb.ResourceStatsResponse, error) {
	args := m.Called(ctx, orgID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*resourcepb.ResourceStatsResponse), args.Error(1)
}

func (m *MockK8sHandler) GetUsersFromMeta(ctx context.Context, userMeta []string) (map[string]*user.User, error) {
	args := m.Called(ctx, userMeta)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(map[string]*user.User), args.Error(1)
}

func TestNewSCIMUtil(t *testing.T) {
	tests := []struct {
		name      string
		k8sClient client.K8sHandler
	}{
		{
			name:      "with k8s client",
			k8sClient: &MockK8sHandler{},
		},
		{
			name:      "without k8s client",
			k8sClient: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			util := NewSCIMUtil(tt.k8sClient)
			assert.NotNil(t, util)
			assert.Equal(t, tt.k8sClient, util.k8sClient)
			assert.NotNil(t, util.logger)
		})
	}
}

func TestSCIMUtil_IsUserSyncEnabled(t *testing.T) {
	ctx := context.Background()
	orgID := int64(1)

	tests := []struct {
		name           string
		k8sClient      client.K8sHandler
		staticEnabled  bool
		expectedResult bool
		setupMock      func(*MockK8sHandler)
	}{
		{
			name:           "k8s client nil - returns static config",
			k8sClient:      nil,
			staticEnabled:  true,
			expectedResult: true,
		},
		{
			name:           "k8s client nil - returns static config false",
			k8sClient:      nil,
			staticEnabled:  false,
			expectedResult: false,
		},
		{
			name:          "k8s client error - falls back to static config",
			k8sClient:     &MockK8sHandler{},
			staticEnabled: true,
			setupMock: func(mockHandler *MockK8sHandler) {
				mockHandler.On("Get", ctx, "default", orgID, metav1.GetOptions{}, mock.Anything).
					Return(nil, errors.New("k8s error"))
			},
			expectedResult: true,
		},
		{
			name:          "dynamic config user sync enabled",
			k8sClient:     &MockK8sHandler{},
			staticEnabled: false,
			setupMock: func(mockHandler *MockK8sHandler) {
				obj := createMockSCIMConfig(true, false)
				mockHandler.On("Get", ctx, "default", orgID, metav1.GetOptions{}, mock.Anything).
					Return(obj, nil)
			},
			expectedResult: true,
		},
		{
			name:          "dynamic config user sync disabled",
			k8sClient:     &MockK8sHandler{},
			staticEnabled: true,
			setupMock: func(mockHandler *MockK8sHandler) {
				obj := createMockSCIMConfig(false, true)
				mockHandler.On("Get", ctx, "default", orgID, metav1.GetOptions{}, mock.Anything).
					Return(obj, nil)
			},
			expectedResult: false,
		},
		{
			name:          "dynamic config both settings disabled",
			k8sClient:     &MockK8sHandler{},
			staticEnabled: true,
			setupMock: func(mockHandler *MockK8sHandler) {
				obj := createMockSCIMConfig(false, false)
				mockHandler.On("Get", ctx, "default", orgID, metav1.GetOptions{}, mock.Anything).
					Return(obj, nil)
			},
			expectedResult: false,
		},
		{
			name:          "dynamic config both settings enabled",
			k8sClient:     &MockK8sHandler{},
			staticEnabled: false,
			setupMock: func(mockHandler *MockK8sHandler) {
				obj := createMockSCIMConfig(true, true)
				mockHandler.On("Get", ctx, "default", orgID, metav1.GetOptions{}, mock.Anything).
					Return(obj, nil)
			},
			expectedResult: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupMock != nil {
				tt.setupMock(tt.k8sClient.(*MockK8sHandler))
			}

			util := NewSCIMUtil(tt.k8sClient)
			result := util.IsUserSyncEnabled(ctx, orgID, tt.staticEnabled)

			assert.Equal(t, tt.expectedResult, result)

			if tt.k8sClient != nil {
				tt.k8sClient.(*MockK8sHandler).AssertExpectations(t)
			}
		})
	}
}

func TestSCIMUtil_AreNonProvisionedUsersRejected(t *testing.T) {
	ctx := context.Background()
	orgID := int64(1)

	tests := []struct {
		name           string
		k8sClient      client.K8sHandler
		staticRejected bool
		expectedResult bool
		setupMock      func(*MockK8sHandler)
	}{
		{
			name:           "k8s client nil - returns static config",
			k8sClient:      nil,
			staticRejected: true,
			expectedResult: true,
		},
		{
			name:           "k8s client nil - returns static config false",
			k8sClient:      nil,
			staticRejected: false,
			expectedResult: false,
		},
		{
			name:           "k8s client error - falls back to static config",
			k8sClient:      &MockK8sHandler{},
			staticRejected: true,
			setupMock: func(mockHandler *MockK8sHandler) {
				mockHandler.On("Get", ctx, "default", orgID, metav1.GetOptions{}, mock.Anything).
					Return(nil, errors.New("k8s error"))
			},
			expectedResult: true,
		},
		{
			name:           "dynamic config user sync enabled - non-provisioned users rejected",
			k8sClient:      &MockK8sHandler{},
			staticRejected: false,
			setupMock: func(mockHandler *MockK8sHandler) {
				obj := createMockSCIMConfigWithNonProvisioned(true, false, true)
				mockHandler.On("Get", ctx, "default", orgID, metav1.GetOptions{}, mock.Anything).
					Return(obj, nil)
			},
			expectedResult: true,
		},
		{
			name:           "dynamic config user sync disabled - non-provisioned users allowed",
			k8sClient:      &MockK8sHandler{},
			staticRejected: true,
			setupMock: func(mockHandler *MockK8sHandler) {
				obj := createMockSCIMConfigWithNonProvisioned(false, true, false)
				mockHandler.On("Get", ctx, "default", orgID, metav1.GetOptions{}, mock.Anything).
					Return(obj, nil)
			},
			expectedResult: false,
		},
		{
			name:           "dynamic config both settings disabled - non-provisioned users allowed",
			k8sClient:      &MockK8sHandler{},
			staticRejected: true,
			setupMock: func(mockHandler *MockK8sHandler) {
				obj := createMockSCIMConfigWithNonProvisioned(false, false, false)
				mockHandler.On("Get", ctx, "default", orgID, metav1.GetOptions{}, mock.Anything).
					Return(obj, nil)
			},
			expectedResult: false,
		},
		{
			name:           "dynamic config both settings enabled - non-provisioned users rejected",
			k8sClient:      &MockK8sHandler{},
			staticRejected: false,
			setupMock: func(mockHandler *MockK8sHandler) {
				obj := createMockSCIMConfigWithNonProvisioned(true, true, true)
				mockHandler.On("Get", ctx, "default", orgID, metav1.GetOptions{}, mock.Anything).
					Return(obj, nil)
			},
			expectedResult: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupMock != nil {
				tt.setupMock(tt.k8sClient.(*MockK8sHandler))
			}

			util := NewSCIMUtil(tt.k8sClient)
			result := util.AreNonProvisionedUsersRejected(ctx, orgID, tt.staticRejected)

			assert.Equal(t, tt.expectedResult, result)

			if tt.k8sClient != nil {
				tt.k8sClient.(*MockK8sHandler).AssertExpectations(t)
			}
		})
	}
}

func TestSCIMUtil_fetchDynamicSCIMSetting(t *testing.T) {
	ctx := context.Background()
	orgID := int64(1)

	tests := []struct {
		name                   string
		k8sClient              client.K8sHandler
		settingType            string
		expectedEnabled        bool
		expectedDynamicFetched bool
		setupMock              func(*MockK8sHandler)
	}{
		{
			name:                   "k8s client nil",
			k8sClient:              nil,
			settingType:            "user",
			expectedEnabled:        false,
			expectedDynamicFetched: false,
		},
		{
			name:                   "invalid setting type",
			k8sClient:              &MockK8sHandler{},
			settingType:            "invalid",
			expectedEnabled:        false,
			expectedDynamicFetched: false,
			setupMock: func(mockHandler *MockK8sHandler) {
				obj := createMockSCIMConfig(true, false)
				mockHandler.On("Get", ctx, "default", orgID, metav1.GetOptions{}, mock.Anything).
					Return(obj, nil)
			},
		},
		{
			name:                   "k8s client error",
			k8sClient:              &MockK8sHandler{},
			settingType:            "user",
			expectedEnabled:        false,
			expectedDynamicFetched: false,
			setupMock: func(mockHandler *MockK8sHandler) {
				mockHandler.On("Get", ctx, "default", orgID, metav1.GetOptions{}, mock.Anything).
					Return(nil, errors.New("k8s error"))
			},
		},
		{
			name:                   "user sync setting enabled",
			k8sClient:              &MockK8sHandler{},
			settingType:            "user",
			expectedEnabled:        true,
			expectedDynamicFetched: true,
			setupMock: func(mockHandler *MockK8sHandler) {
				obj := createMockSCIMConfig(true, false)
				mockHandler.On("Get", ctx, "default", orgID, metav1.GetOptions{}, mock.Anything).
					Return(obj, nil)
			},
		},
		{
			name:                   "user sync setting disabled",
			k8sClient:              &MockK8sHandler{},
			settingType:            "user",
			expectedEnabled:        false,
			expectedDynamicFetched: true,
			setupMock: func(mockHandler *MockK8sHandler) {
				obj := createMockSCIMConfig(false, true)
				mockHandler.On("Get", ctx, "default", orgID, metav1.GetOptions{}, mock.Anything).
					Return(obj, nil)
			},
		},
		{
			name:                   "group sync setting enabled",
			k8sClient:              &MockK8sHandler{},
			settingType:            "group",
			expectedEnabled:        true,
			expectedDynamicFetched: true,
			setupMock: func(mockHandler *MockK8sHandler) {
				obj := createMockSCIMConfig(false, true)
				mockHandler.On("Get", ctx, "default", orgID, metav1.GetOptions{}, mock.Anything).
					Return(obj, nil)
			},
		},
		{
			name:                   "group sync setting disabled",
			k8sClient:              &MockK8sHandler{},
			settingType:            "group",
			expectedEnabled:        false,
			expectedDynamicFetched: true,
			setupMock: func(mockHandler *MockK8sHandler) {
				obj := createMockSCIMConfig(true, false)
				mockHandler.On("Get", ctx, "default", orgID, metav1.GetOptions{}, mock.Anything).
					Return(obj, nil)
			},
		},
		{
			name:                   "user sync setting - both settings disabled",
			k8sClient:              &MockK8sHandler{},
			settingType:            "user",
			expectedEnabled:        false,
			expectedDynamicFetched: true,
			setupMock: func(mockHandler *MockK8sHandler) {
				obj := createMockSCIMConfig(false, false)
				mockHandler.On("Get", ctx, "default", orgID, metav1.GetOptions{}, mock.Anything).
					Return(obj, nil)
			},
		},
		{
			name:                   "user sync setting - both settings enabled",
			k8sClient:              &MockK8sHandler{},
			settingType:            "user",
			expectedEnabled:        true,
			expectedDynamicFetched: true,
			setupMock: func(mockHandler *MockK8sHandler) {
				obj := createMockSCIMConfig(true, true)
				mockHandler.On("Get", ctx, "default", orgID, metav1.GetOptions{}, mock.Anything).
					Return(obj, nil)
			},
		},
		{
			name:                   "group sync setting - both settings disabled",
			k8sClient:              &MockK8sHandler{},
			settingType:            "group",
			expectedEnabled:        false,
			expectedDynamicFetched: true,
			setupMock: func(mockHandler *MockK8sHandler) {
				obj := createMockSCIMConfig(false, false)
				mockHandler.On("Get", ctx, "default", orgID, metav1.GetOptions{}, mock.Anything).
					Return(obj, nil)
			},
		},
		{
			name:                   "group sync setting - both settings enabled",
			k8sClient:              &MockK8sHandler{},
			settingType:            "group",
			expectedEnabled:        true,
			expectedDynamicFetched: true,
			setupMock: func(mockHandler *MockK8sHandler) {
				obj := createMockSCIMConfig(true, true)
				mockHandler.On("Get", ctx, "default", orgID, metav1.GetOptions{}, mock.Anything).
					Return(obj, nil)
			},
		},
		{
			name:                   "rejectNonProvisionedUsers setting enabled",
			k8sClient:              &MockK8sHandler{},
			settingType:            "rejectNonProvisionedUsers",
			expectedEnabled:        true,
			expectedDynamicFetched: true,
			setupMock: func(mockHandler *MockK8sHandler) {
				obj := createMockSCIMConfigWithNonProvisioned(false, false, true)
				mockHandler.On("Get", ctx, "default", orgID, metav1.GetOptions{}, mock.Anything).
					Return(obj, nil)
			},
		},
		{
			name:                   "rejectNonProvisionedUsers setting disabled",
			k8sClient:              &MockK8sHandler{},
			settingType:            "rejectNonProvisionedUsers",
			expectedEnabled:        false,
			expectedDynamicFetched: true,
			setupMock: func(mockHandler *MockK8sHandler) {
				obj := createMockSCIMConfigWithNonProvisioned(true, true, false)
				mockHandler.On("Get", ctx, "default", orgID, metav1.GetOptions{}, mock.Anything).
					Return(obj, nil)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupMock != nil {
				tt.setupMock(tt.k8sClient.(*MockK8sHandler))
			}

			util := NewSCIMUtil(tt.k8sClient)
			enabled, dynamicFetched := util.fetchDynamicSCIMSetting(ctx, orgID, tt.settingType)

			assert.Equal(t, tt.expectedEnabled, enabled)
			assert.Equal(t, tt.expectedDynamicFetched, dynamicFetched)

			if tt.k8sClient != nil {
				tt.k8sClient.(*MockK8sHandler).AssertExpectations(t)
			}
		})
	}
}

func TestSCIMUtil_getOrgSCIMConfig(t *testing.T) {
	ctx := context.Background()
	orgID := int64(1)

	tests := []struct {
		name          string
		k8sClient     client.K8sHandler
		expectedError error
		setupMock     func(*MockK8sHandler)
	}{
		{
			name:          "k8s client nil",
			k8sClient:     nil,
			expectedError: errors.New("k8s client not configured"),
		},
		{
			name:          "k8s client error",
			k8sClient:     &MockK8sHandler{},
			expectedError: errors.New("k8s error"),
			setupMock: func(mockHandler *MockK8sHandler) {
				mockHandler.On("Get", ctx, "default", orgID, metav1.GetOptions{}, mock.Anything).
					Return(nil, errors.New("k8s error"))
			},
		},
		{
			name:      "successful fetch",
			k8sClient: &MockK8sHandler{},
			setupMock: func(mockHandler *MockK8sHandler) {
				obj := createMockSCIMConfig(true, false)
				mockHandler.On("Get", ctx, "default", orgID, metav1.GetOptions{}, mock.Anything).
					Return(obj, nil)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupMock != nil {
				tt.setupMock(tt.k8sClient.(*MockK8sHandler))
			}

			util := NewSCIMUtil(tt.k8sClient)
			config, err := util.getOrgSCIMConfig(ctx, orgID)

			if tt.expectedError != nil {
				assert.Error(t, err)
				assert.Nil(t, config)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, config)
				assert.Equal(t, true, config.EnableUserSync)
				assert.Equal(t, false, config.EnableGroupSync)
			}

			if tt.k8sClient != nil {
				tt.k8sClient.(*MockK8sHandler).AssertExpectations(t)
			}
		})
	}
}

func TestSCIMUtil_unstructuredToSCIMConfig(t *testing.T) {
	tests := []struct {
		name          string
		obj           *unstructured.Unstructured
		expectedError bool
		expectedSpec  SCIMConfigSpec
	}{
		{
			name:          "nil object",
			obj:           nil,
			expectedError: true,
		},
		{
			name: "valid object with both settings enabled",
			obj:  createMockSCIMConfig(true, true),
			expectedSpec: SCIMConfigSpec{
				EnableUserSync:            true,
				EnableGroupSync:           true,
				RejectNonProvisionedUsers: false,
			},
		},
		{
			name: "valid object with both settings disabled",
			obj:  createMockSCIMConfig(false, false),
			expectedSpec: SCIMConfigSpec{
				EnableUserSync:            false,
				EnableGroupSync:           false,
				RejectNonProvisionedUsers: false,
			},
		},
		{
			name: "valid object with mixed settings",
			obj:  createMockSCIMConfig(true, false),
			expectedSpec: SCIMConfigSpec{
				EnableUserSync:            true,
				EnableGroupSync:           false,
				RejectNonProvisionedUsers: false,
			},
		},
		{
			name: "valid object with rejectNonProvisionedUsers enabled",
			obj:  createMockSCIMConfigWithNonProvisioned(false, false, true),
			expectedSpec: SCIMConfigSpec{
				EnableUserSync:            false,
				EnableGroupSync:           false,
				RejectNonProvisionedUsers: true,
			},
		},
		{
			name: "object with missing spec",
			obj: &unstructured.Unstructured{
				Object: map[string]interface{}{
					"apiVersion": "scim.grafana.com/v0alpha1",
					"kind":       "SCIMConfig",
					"metadata": map[string]interface{}{
						"name":      "test-config",
						"namespace": "default",
					},
				},
			},
			expectedError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			util := NewSCIMUtil(nil)
			config, err := util.unstructuredToSCIMConfig(tt.obj)

			if tt.expectedError {
				assert.Error(t, err)
				assert.Nil(t, config)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, config)
				assert.Equal(t, tt.expectedSpec, *config)
			}
		})
	}
}

// Helper function to create a mock SCIMConfig unstructured object
func createMockSCIMConfig(userSyncEnabled, groupSyncEnabled bool) *unstructured.Unstructured {
	return createMockSCIMConfigWithNonProvisioned(userSyncEnabled, groupSyncEnabled, false)
}

// Helper function to create a mock SCIMConfig unstructured object with non-provisioned users setting
func createMockSCIMConfigWithNonProvisioned(userSyncEnabled, groupSyncEnabled, rejectNonProvisionedUsers bool) *unstructured.Unstructured {
	return &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": "scim.grafana.com/v0alpha1",
			"kind":       "SCIMConfig",
			"metadata": map[string]interface{}{
				"name":      "test-config",
				"namespace": "default",
			},
			"spec": map[string]interface{}{
				"enableUserSync":            userSyncEnabled,
				"enableGroupSync":           groupSyncEnabled,
				"rejectNonProvisionedUsers": rejectNonProvisionedUsers,
			},
		},
	}
}

// Test integration scenarios
func TestSCIMUtil_Integration(t *testing.T) {
	ctx := context.Background()
	orgID := int64(1)

	t.Run("full workflow with dynamic config", func(t *testing.T) {
		mockClient := &MockK8sHandler{}
		obj := createMockSCIMConfigWithNonProvisioned(true, false, true)
		mockClient.On("Get", ctx, "default", orgID, metav1.GetOptions{}, mock.Anything).
			Return(obj, nil)

		util := NewSCIMUtil(mockClient)

		// Test user sync enabled
		userSyncEnabled := util.IsUserSyncEnabled(ctx, orgID, false)
		assert.True(t, userSyncEnabled)

		// Test non-provisioned users rejected
		nonProvisionedRejected := util.AreNonProvisionedUsersRejected(ctx, orgID, false)
		assert.True(t, nonProvisionedRejected)

		mockClient.AssertExpectations(t)
	})

	t.Run("full workflow with static fallback", func(t *testing.T) {
		mockClient := &MockK8sHandler{}
		mockClient.On("Get", ctx, "default", orgID, metav1.GetOptions{}, mock.Anything).
			Return(nil, errors.New("k8s error"))

		util := NewSCIMUtil(mockClient)

		// Test user sync falls back to static config
		userSyncEnabled := util.IsUserSyncEnabled(ctx, orgID, true)
		assert.True(t, userSyncEnabled)

		// Test non-provisioned users falls back to static config
		nonProvisionedRejected := util.AreNonProvisionedUsersRejected(ctx, orgID, true)
		assert.True(t, nonProvisionedRejected)

		mockClient.AssertExpectations(t)
	})
}
