package resourcepermissions

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"

	dashboardv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	folderv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/licensing/licensingtest"
	"github.com/grafana/grafana/pkg/setting"
)

// TestGetPermissionKind tests the permission kind mapping logic
func TestGetPermissionKind(t *testing.T) {
	api := &api{
		service: &Service{
			options: Options{
				Resource:          "dashboards",
				ResourceAttribute: "uid",
			},
		},
	}

	tests := []struct {
		name     string
		perm     accesscontrol.SetResourcePermissionCommand
		expected string
	}{
		{
			name:     "user permission",
			perm:     accesscontrol.SetResourcePermissionCommand{UserID: 123},
			expected: string(iamv0.ResourcePermissionSpecPermissionKindUser),
		},
		{
			name:     "team permission",
			perm:     accesscontrol.SetResourcePermissionCommand{TeamID: 456},
			expected: string(iamv0.ResourcePermissionSpecPermissionKindTeam),
		},
		{
			name:     "builtin role permission",
			perm:     accesscontrol.SetResourcePermissionCommand{BuiltinRole: "Editor"},
			expected: string(iamv0.ResourcePermissionSpecPermissionKindBasicRole),
		},
		{
			name:     "empty permission returns empty kind",
			perm:     accesscontrol.SetResourcePermissionCommand{},
			expected: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			kind := api.getPermissionKind(tt.perm)
			assert.Equal(t, tt.expected, kind)
		})
	}
}

// TestGetDynamicClient_RestConfigNotAvailable tests error handling when rest config is not available
func TestGetDynamicClient_RestConfigNotAvailable(t *testing.T) {
	ctx := context.Background()

	api := &api{
		service: &Service{
			options: Options{
				Resource: "dashboards",
			},
		},
		restConfigProvider: nil,
	}

	client, err := api.getDynamicClient(ctx)

	assert.Error(t, err)
	assert.Nil(t, client)
	assert.Equal(t, ErrRestConfigNotAvailable, err)
}

// TestBuildResourcePermissionName tests resource permission name building
func TestBuildResourcePermissionName(t *testing.T) {
	tests := []struct {
		name         string
		apiGroup     string
		resource     string
		resourceID   string
		expectedName string
	}{
		{
			name:         "with custom API group",
			apiGroup:     "dashboard.grafana.app",
			resource:     "dashboards",
			resourceID:   "dashboard-uid-123",
			expectedName: "dashboard.grafana.app-dashboards-dashboard-uid-123",
		},
		{
			name:         "with default API group",
			apiGroup:     "",
			resource:     "folders",
			resourceID:   "folder-uid-456",
			expectedName: "folders.grafana.app-folders-folder-uid-456",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			api := &api{
				service: &Service{
					options: Options{
						Resource: tt.resource,
						APIGroup: tt.apiGroup,
					},
				},
			}

			name := api.buildResourcePermissionName(tt.resourceID)
			assert.Equal(t, tt.expectedName, name)
		})
	}
}

// TestGetAPIGroup tests API group resolution
func TestGetAPIGroup(t *testing.T) {
	t.Run("returns custom API group when set", func(t *testing.T) {
		api := &api{
			service: &Service{
				options: Options{
					Resource: "dashboards",
					APIGroup: "custom.grafana.app",
				},
			},
		}

		group := api.getAPIGroup()
		assert.Equal(t, "custom.grafana.app", group)
	})

	t.Run("returns default API group when not set", func(t *testing.T) {
		api := &api{
			service: &Service{
				options: Options{
					Resource: "dashboards",
					APIGroup: "",
				},
			},
		}

		group := api.getAPIGroup()
		assert.Equal(t, "dashboards.grafana.app", group)
	})

	t.Run("default group for folders", func(t *testing.T) {
		api := &api{
			service: &Service{
				options: Options{
					Resource: "folders",
					APIGroup: "",
				},
			},
		}

		group := api.getAPIGroup()
		assert.Equal(t, "folders.grafana.app", group)
	})
}

// TestResourcePermissionKindConstants verifies the kind constants match expected values
func TestResourcePermissionKindConstants(t *testing.T) {
	tests := []struct {
		name     string
		kind     iamv0.ResourcePermissionSpecPermissionKind
		expected string
	}{
		{
			name:     "User kind",
			kind:     iamv0.ResourcePermissionSpecPermissionKindUser,
			expected: "User",
		},
		{
			name:     "Team kind",
			kind:     iamv0.ResourcePermissionSpecPermissionKindTeam,
			expected: "Team",
		},
		{
			name:     "ServiceAccount kind",
			kind:     iamv0.ResourcePermissionSpecPermissionKindServiceAccount,
			expected: "ServiceAccount",
		},
		{
			name:     "BasicRole kind",
			kind:     iamv0.ResourcePermissionSpecPermissionKindBasicRole,
			expected: "BasicRole",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expected, string(tt.kind))
		})
	}
}

// TestConvertK8sResourcePermissionToDTO tests converting K8s resource permission to DTO
func TestConvertK8sResourcePermissionToDTO(t *testing.T) {
	folderPermission := &iamv0.ResourcePermission{
		Spec: iamv0.ResourcePermissionSpec{
			Permissions: []iamv0.ResourcePermissionspecPermission{
				{
					Kind: iamv0.ResourcePermissionSpecPermissionKindBasicRole,
					Name: "Editor",
					Verb: "edit",
				},
				{
					Kind: iamv0.ResourcePermissionSpecPermissionKindBasicRole,
					Name: "Viewer",
					Verb: "view",
				},
			},
		},
	}

	license := licensingtest.NewFakeLicensing()
	license.On("FeatureEnabled", "accesscontrol.enforcement").Return(false).Maybe()

	api := &api{
		cfg:    &setting.Cfg{},
		logger: log.New("test"),
		service: &Service{
			options: Options{
				Resource:          "dashboards",
				ResourceAttribute: "uid",
				APIGroup:          dashboardv1.APIGroup,
				PermissionsToActions: map[string][]string{
					"View": {"dashboards:read"},
					"Edit": {"dashboards:read", "dashboards:write"},
				},
			},
			actions: []string{"dashboards:read", "dashboards:write"},
			license: license,
		},
	}

	inheritedPerms, err := api.convertK8sResourcePermissionToDTO(folderPermission, "stack-123-org-1", true)

	require.NoError(t, err)
	require.Len(t, inheritedPerms, 2, "should have 2 inherited permissions (Editor and Viewer)")

	editorPerm := inheritedPerms[0]
	assert.Equal(t, "Editor", editorPerm.BuiltInRole, "should inherit Editor role from parent folder")
	assert.True(t, editorPerm.IsInherited, "Editor permission should be marked as inherited from parent folder")
	assert.Contains(t, editorPerm.Actions, "dashboards:read")
	assert.Contains(t, editorPerm.Actions, "dashboards:write")

	viewerPerm := inheritedPerms[1]
	assert.Equal(t, "Viewer", viewerPerm.BuiltInRole, "should inherit Viewer role from parent folder")
	assert.True(t, viewerPerm.IsInherited, "Viewer permission should be marked as inherited from parent folder")
	assert.Contains(t, viewerPerm.Actions, "dashboards:read")
	assert.NotContains(t, viewerPerm.Actions, "dashboards:write", "Viewer permission should not include write")
}

// TestGetFolderHierarchyPermissions tests the folder hierarchy permissions logic
func TestGetFolderHierarchyPermissions(t *testing.T) {
	tests := []struct {
		name              string
		folderUID         string
		skipSelf          bool
		folderInfoList    []folderv1.FolderInfo
		folderPermissions map[string]*iamv0.ResourcePermission
		expectedCount     int
		expectedRoles     []string
	}{
		{
			name:      "dashboard inherits from direct parent folder",
			folderUID: "fold1",
			skipSelf:  false,
			folderInfoList: []folderv1.FolderInfo{
				{Name: "fold1", Title: "Folder 1"},
			},
			folderPermissions: map[string]*iamv0.ResourcePermission{
				"fold1": {
					Spec: iamv0.ResourcePermissionSpec{
						Permissions: []iamv0.ResourcePermissionspecPermission{
							{Kind: iamv0.ResourcePermissionSpecPermissionKindBasicRole, Name: "Editor", Verb: "edit"},
						},
					},
				},
			},
			expectedCount: 1,
			expectedRoles: []string{"Editor"},
		},
		{
			name:      "folder skips its own permissions",
			folderUID: "fold1",
			skipSelf:  true,
			folderInfoList: []folderv1.FolderInfo{
				{Name: "fold1", Title: "Folder 1"},
			},
			folderPermissions: map[string]*iamv0.ResourcePermission{
				"fold1": {
					Spec: iamv0.ResourcePermissionSpec{
						Permissions: []iamv0.ResourcePermissionspecPermission{
							{Kind: iamv0.ResourcePermissionSpecPermissionKindBasicRole, Name: "Editor", Verb: "edit"},
						},
					},
				},
			},
			expectedCount: 0,
			expectedRoles: []string{},
		},
		{
			name:      "dashboard inherits from parent and grandparent",
			folderUID: "fold2",
			skipSelf:  false,
			folderInfoList: []folderv1.FolderInfo{
				{Name: "fold2", Title: "Folder 2", Parent: "fold1"},
				{Name: "fold1", Title: "Folder 1"},
			},
			folderPermissions: map[string]*iamv0.ResourcePermission{
				"fold1": {
					Spec: iamv0.ResourcePermissionSpec{
						Permissions: []iamv0.ResourcePermissionspecPermission{
							{Kind: iamv0.ResourcePermissionSpecPermissionKindBasicRole, Name: "Viewer", Verb: "view"},
						},
					},
				},
				"fold2": {
					Spec: iamv0.ResourcePermissionSpec{
						Permissions: []iamv0.ResourcePermissionspecPermission{
							{Kind: iamv0.ResourcePermissionSpecPermissionKindBasicRole, Name: "Editor", Verb: "edit"},
						},
					},
				},
			},
			expectedCount: 2,
			expectedRoles: []string{"Editor", "Viewer"},
		},
		{
			name:      "folder only inherits from parent, skips self",
			folderUID: "fold2",
			skipSelf:  true,
			folderInfoList: []folderv1.FolderInfo{
				{Name: "fold2", Title: "Folder 2", Parent: "fold1"},
				{Name: "fold1", Title: "Folder 1"},
			},
			folderPermissions: map[string]*iamv0.ResourcePermission{
				"fold1": {
					Spec: iamv0.ResourcePermissionSpec{
						Permissions: []iamv0.ResourcePermissionspecPermission{
							{Kind: iamv0.ResourcePermissionSpecPermissionKindBasicRole, Name: "Viewer", Verb: "view"},
						},
					},
				},
				"fold2": {
					Spec: iamv0.ResourcePermissionSpec{
						Permissions: []iamv0.ResourcePermissionspecPermission{
							{Kind: iamv0.ResourcePermissionSpecPermissionKindBasicRole, Name: "Editor", Verb: "edit"},
						},
					},
				},
			},
			expectedCount: 1,
			expectedRoles: []string{"Viewer"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			license := licensingtest.NewFakeLicensing()
			license.On("FeatureEnabled", "accesscontrol.enforcement").Return(false).Maybe()

			api := &api{
				cfg:    &setting.Cfg{},
				logger: log.New("test"),
				service: &Service{
					options: Options{
						Resource:          "dashboards",
						ResourceAttribute: "uid",
						APIGroup:          dashboardv1.APIGroup,
						PermissionsToActions: map[string][]string{
							"View": {"dashboards:read"},
							"Edit": {"dashboards:read", "dashboards:write"},
						},
					},
					actions: []string{"dashboards:read", "dashboards:write"},
					license: license,
				},
			}

			fakeClient, fakeResourceInterface := setupFakeDynamicClient(t, tt.folderUID, tt.folderInfoList, tt.folderPermissions)
			perms, err := api.getFolderHierarchyPermissions(context.Background(), "stack-123-org-1", tt.folderUID, fakeClient, tt.skipSelf)

			require.NoError(t, err)
			assert.Len(t, perms, tt.expectedCount, "expected %d permissions", tt.expectedCount)

			actualRoles := make([]string, len(perms))
			for i, perm := range perms {
				actualRoles[i] = perm.BuiltInRole
			}
			assert.ElementsMatch(t, tt.expectedRoles, actualRoles, "expected roles to match")

			for _, perm := range perms {
				assert.True(t, perm.IsInherited, "permission should be marked as inherited")
			}

			// Verify mock was called
			_ = fakeResourceInterface
		})
	}
}

// setupFakeDynamicClient creates a fake dynamic client with mocked folder hierarchy and permissions
func setupFakeDynamicClient(t *testing.T, folderUID string, folderInfoList []folderv1.FolderInfo, folderPermissions map[string]*iamv0.ResourcePermission) (dynamic.Interface, *fakeResourceInterface) {
	t.Helper()

	fakeResource := &fakeResourceInterface{}
	fakeClient := &fakeDynamicClient{resourceInterface: fakeResource}

	fakeResource.getFunc = func(ctx context.Context, name string, opts metav1.GetOptions, subresources ...string) (*unstructured.Unstructured, error) {
		if len(subresources) > 0 && subresources[0] == "parents" {
			// Return the folder hierarchy
			folderList := &folderv1.FolderInfoList{
				TypeMeta: metav1.TypeMeta{
					APIVersion: folderv1.APIGroup + "/" + folderv1.APIVersion,
					Kind:       "FolderInfoList",
				},
				Items: folderInfoList,
			}

			unstructuredObj, err := runtime.DefaultUnstructuredConverter.ToUnstructured(folderList)
			require.NoError(t, err)
			return &unstructured.Unstructured{Object: unstructuredObj}, nil
		}

		const resourcePermNamePrefix = "folder.grafana.app-folders-"
		var folderName string
		if len(name) > len(resourcePermNamePrefix) {
			folderName = name[len(resourcePermNamePrefix):]
		}

		if perm, ok := folderPermissions[folderName]; ok {
			unstructuredObj, err := runtime.DefaultUnstructuredConverter.ToUnstructured(perm)
			require.NoError(t, err)
			return &unstructured.Unstructured{Object: unstructuredObj}, nil
		}

		return nil, errors.New("not found")
	}

	return fakeClient, fakeResource
}

// fakeDynamicClient is a fake implementation of dynamic.Interface for testing
type fakeDynamicClient struct {
	resourceInterface dynamic.ResourceInterface
}

func (f *fakeDynamicClient) Resource(resource schema.GroupVersionResource) dynamic.NamespaceableResourceInterface {
	return &fakeNamespaceableResourceInterface{
		resourceInterface: f.resourceInterface,
	}
}

// fakeNamespaceableResourceInterface is a fake implementation of dynamic.NamespaceableResourceInterface
type fakeNamespaceableResourceInterface struct {
	dynamic.NamespaceableResourceInterface
	resourceInterface dynamic.ResourceInterface
}

func (f *fakeNamespaceableResourceInterface) Namespace(namespace string) dynamic.ResourceInterface {
	if f.resourceInterface != nil {
		return f.resourceInterface
	}
	return &fakeResourceInterface{}
}

// fakeResourceInterface is a fake implementation of dynamic.ResourceInterface
type fakeResourceInterface struct {
	dynamic.ResourceInterface
	getFunc func(ctx context.Context, name string, opts metav1.GetOptions, subresources ...string) (*unstructured.Unstructured, error)
}

func (f *fakeResourceInterface) Get(ctx context.Context, name string, opts metav1.GetOptions, subresources ...string) (*unstructured.Unstructured, error) {
	if f.getFunc != nil {
		return f.getFunc(ctx, name, opts, subresources...)
	}
	return &unstructured.Unstructured{}, nil
}

// TestGetProvisionedPermissions tests retrieval of provisioned permissions from legacy API
func TestGetProvisionedPermissions(t *testing.T) {
	t.Run("returns only provisioned permissions, not managed or inherited", func(t *testing.T) {
		license := licensingtest.NewFakeLicensing()
		license.On("FeatureEnabled", "accesscontrol.enforcement").Return(false).Maybe()

		// Create a mock store that returns mixed permissions
		mockStore := &mockResourcePermissionStore{
			permissions: []accesscontrol.ResourcePermission{
				// Managed permission (should be filtered out)
				{
					UserID:      1,
					Actions:     []string{"dashboards:read", "dashboards:write"},
					IsManaged:   true,
					IsInherited: false,
				},
				// Inherited permission (should be filtered out)
				{
					UserID:      2,
					Actions:     []string{"dashboards:read"},
					IsManaged:   false,
					IsInherited: true,
				},
				// Provisioned permission (should be included)
				{
					UserID:      3,
					UserLogin:   "provisioned-user",
					Actions:     []string{"dashboards:read", "dashboards:write"},
					IsManaged:   false,
					IsInherited: false,
				},
				// Another provisioned permission (should be included)
				{
					TeamID:      100,
					Team:        "provisioned-team",
					Actions:     []string{"dashboards:read"},
					IsManaged:   false,
					IsInherited: false,
				},
			},
		}

		api := &api{
			cfg:    &setting.Cfg{},
			logger: log.New("test"),
			service: &Service{
				store: mockStore,
				options: Options{
					Resource:          "dashboards",
					ResourceAttribute: "uid",
					APIGroup:          dashboardv1.APIGroup,
					PermissionsToActions: map[string][]string{
						"View": {"dashboards:read"},
						"Edit": {"dashboards:read", "dashboards:write"},
					},
				},
				actions:     []string{"dashboards:read", "dashboards:write"},
				permissions: []string{"Edit", "View"}, // Add permissions list for MapActions
				license:     license,
			},
		}

		provisionedPerms, err := api.getProvisionedPermissions(context.Background(), "stack-123-org-1", "dashboard-123")

		require.NoError(t, err)
		require.Len(t, provisionedPerms, 2, "should return only provisioned permissions")

		// Verify first provisioned permission
		assert.Equal(t, int64(3), provisionedPerms[0].UserID)
		assert.Equal(t, "provisioned-user", provisionedPerms[0].UserLogin)
		assert.Equal(t, "Edit", provisionedPerms[0].Permission)
		assert.False(t, provisionedPerms[0].IsManaged, "provisioned permission should not be managed")
		assert.False(t, provisionedPerms[0].IsInherited, "provisioned permission should not be inherited")

		// Verify second provisioned permission
		assert.Equal(t, int64(100), provisionedPerms[1].TeamID)
		assert.Equal(t, "provisioned-team", provisionedPerms[1].Team)
		assert.Equal(t, "View", provisionedPerms[1].Permission)
		assert.False(t, provisionedPerms[1].IsManaged, "provisioned permission should not be managed")
		assert.False(t, provisionedPerms[1].IsInherited, "provisioned permission should not be inherited")
	})
}

// TestGetResourcePermissionsFromK8s_AdminRole tests that Admin role is added when access control enforcement is disabled
func TestGetResourcePermissionsFromK8s_AdminRole(t *testing.T) {
	t.Run("adds admin role when access control enforcement is disabled", func(t *testing.T) {
		license := licensingtest.NewFakeLicensing()
		license.On("FeatureEnabled", "accesscontrol.enforcement").Return(false).Maybe()

		mockStore := &mockResourcePermissionStore{
			permissions: []accesscontrol.ResourcePermission{},
		}

		api := &api{
			cfg:    &setting.Cfg{},
			logger: log.New("test"),
			service: &Service{
				store: mockStore,
				options: Options{
					Resource:          "dashboards",
					ResourceAttribute: "uid",
					APIGroup:          dashboardv1.APIGroup,
					Assignments: Assignments{
						BuiltInRoles: true, // Enable built-in roles
					},
					PermissionsToActions: map[string][]string{
						"View":  {"dashboards:read"},
						"Edit":  {"dashboards:read", "dashboards:write"},
						"Admin": {"dashboards:read", "dashboards:write", "dashboards:delete", "dashboards.permissions:read", "dashboards.permissions:write"},
					},
				},
				actions:     []string{"dashboards:read", "dashboards:write", "dashboards:delete", "dashboards.permissions:read", "dashboards.permissions:write"},
				permissions: []string{"Admin", "Edit", "View"},
				license:     license,
			},
			restConfigProvider: nil, // No rest config provider - will return empty permissions from K8s
		}

		perms, err := api.getResourcePermissionsFromK8s(context.Background(), "stack-123-org-1", "dashboard-123")

		// Should fail to get K8s permissions but still add Admin role
		require.Error(t, err)
		assert.ErrorIs(t, err, ErrRestConfigNotAvailable)
		_ = perms // Suppress unused variable warning
	})

	t.Run("does not add admin role when access control enforcement is enabled", func(t *testing.T) {
		license := licensingtest.NewFakeLicensing()
		license.On("FeatureEnabled", "accesscontrol.enforcement").Return(true).Maybe()

		mockStore := &mockResourcePermissionStore{
			permissions: []accesscontrol.ResourcePermission{},
		}

		api := &api{
			cfg:    &setting.Cfg{},
			logger: log.New("test"),
			service: &Service{
				store: mockStore,
				options: Options{
					Resource:          "dashboards",
					ResourceAttribute: "uid",
					APIGroup:          dashboardv1.APIGroup,
					Assignments: Assignments{
						BuiltInRoles: true,
					},
					PermissionsToActions: map[string][]string{
						"View":  {"dashboards:read"},
						"Edit":  {"dashboards:read", "dashboards:write"},
						"Admin": {"dashboards:read", "dashboards:write", "dashboards:delete"},
					},
				},
				actions:     []string{"dashboards:read", "dashboards:write", "dashboards:delete"},
				permissions: []string{"Admin", "Edit", "View"},
				license:     license,
			},
			restConfigProvider: nil,
		}

		perms, err := api.getResourcePermissionsFromK8s(context.Background(), "stack-123-org-1", "dashboard-123")

		require.Error(t, err)
		assert.ErrorIs(t, err, ErrRestConfigNotAvailable)
		_ = perms // Suppress unused variable warning
	})
}

// TestAdminRoleLogic tests the admin role logic in isolation
func TestAdminRoleLogic(t *testing.T) {
	t.Run("admin role is added when enforcement is disabled and built-in roles are enabled", func(t *testing.T) {
		license := licensingtest.NewFakeLicensing()
		license.On("FeatureEnabled", "accesscontrol.enforcement").Return(false).Maybe()

		service := &Service{
			options: Options{
				Resource:          "dashboards",
				ResourceAttribute: "uid",
				Assignments: Assignments{
					BuiltInRoles: true,
				},
				PermissionsToActions: map[string][]string{
					"View":  {"dashboards:read"},
					"Edit":  {"dashboards:read", "dashboards:write"},
					"Admin": {"dashboards:read", "dashboards:write", "dashboards:delete", "dashboards.permissions:read", "dashboards.permissions:write"},
				},
			},
			actions:     []string{"dashboards:read", "dashboards:write", "dashboards:delete", "dashboards.permissions:read", "dashboards.permissions:write"},
			permissions: []string{"Admin", "Edit", "View"},
			license:     license,
		}

		// Test the condition
		shouldAddAdmin := service.options.Assignments.BuiltInRoles && !service.license.FeatureEnabled("accesscontrol.enforcement")
		assert.True(t, shouldAddAdmin, "should add Admin role when enforcement is disabled and built-in roles are enabled")

		// Test MapActions
		permission := service.MapActions(accesscontrol.ResourcePermission{
			Actions: service.actions,
		})
		assert.Equal(t, "Admin", permission, "should map all actions to Admin permission")
	})

	t.Run("admin role is not added when enforcement is enabled", func(t *testing.T) {
		license := licensingtest.NewFakeLicensing()
		license.On("FeatureEnabled", "accesscontrol.enforcement").Return(true).Maybe()

		service := &Service{
			options: Options{
				Assignments: Assignments{
					BuiltInRoles: true,
				},
			},
			license: license,
		}

		shouldAddAdmin := service.options.Assignments.BuiltInRoles && !service.license.FeatureEnabled("accesscontrol.enforcement")
		assert.False(t, shouldAddAdmin, "should not add Admin role when enforcement is enabled")
	})

	t.Run("admin role is not added when built-in roles are disabled", func(t *testing.T) {
		license := licensingtest.NewFakeLicensing()
		license.On("FeatureEnabled", "accesscontrol.enforcement").Return(false).Maybe()

		service := &Service{
			options: Options{
				Assignments: Assignments{
					BuiltInRoles: false,
				},
			},
			license: license,
		}

		shouldAddAdmin := service.options.Assignments.BuiltInRoles && !service.license.FeatureEnabled("accesscontrol.enforcement")
		assert.False(t, shouldAddAdmin, "should not add Admin role when built-in roles are disabled")
	})
}

// mockRestConfigProvider is a mock implementation of RestConfigProvider for testing
type mockRestConfigProvider struct {
	client dynamic.Interface
}

func (m *mockRestConfigProvider) GetRestConfig(ctx context.Context) (*rest.Config, error) {
	return &rest.Config{}, nil
}

// mockResourcePermissionStore is a mock implementation of the Store interface for testing
type mockResourcePermissionStore struct {
	permissions []accesscontrol.ResourcePermission
}

func (m *mockResourcePermissionStore) GetResourcePermissions(ctx context.Context, orgID int64, query GetResourcePermissionsQuery) ([]accesscontrol.ResourcePermission, error) {
	// Apply ExcludeManaged filter if set (to match real store behavior)
	if query.ExcludeManaged {
		var filtered []accesscontrol.ResourcePermission
		for _, perm := range m.permissions {
			if !perm.IsManaged {
				filtered = append(filtered, perm)
			}
		}
		return filtered, nil
	}
	return m.permissions, nil
}

func (m *mockResourcePermissionStore) SetUserResourcePermission(ctx context.Context, orgID int64, user accesscontrol.User, cmd SetResourcePermissionCommand, hook UserResourceHookFunc) (*accesscontrol.ResourcePermission, error) {
	return nil, nil
}

func (m *mockResourcePermissionStore) SetTeamResourcePermission(ctx context.Context, orgID, teamID int64, cmd SetResourcePermissionCommand, hook TeamResourceHookFunc) (*accesscontrol.ResourcePermission, error) {
	return nil, nil
}

func (m *mockResourcePermissionStore) SetBuiltInResourcePermission(ctx context.Context, orgID int64, builtinRole string, cmd SetResourcePermissionCommand, hook BuiltinResourceHookFunc) (*accesscontrol.ResourcePermission, error) {
	return nil, nil
}

func (m *mockResourcePermissionStore) SetResourcePermissions(ctx context.Context, orgID int64, commands []SetResourcePermissionsCommand, hooks ResourceHooks) ([]accesscontrol.ResourcePermission, error) {
	return nil, nil
}

func (m *mockResourcePermissionStore) DeleteResourcePermissions(ctx context.Context, orgID int64, cmd *DeleteResourcePermissionsCmd) error {
	return nil
}
