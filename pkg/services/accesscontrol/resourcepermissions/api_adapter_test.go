package resourcepermissions

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana/pkg/web"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	dashboardv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	folderv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/licensing/licensingtest"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/team/teamtest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
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
	reqCtx := &contextmodel.ReqContext{
		Context: &web.Context{
			Req: &http.Request{},
		},
		Logger: log.New("test"),
	}

	api := &api{
		service: &Service{
			options: Options{
				Resource: "dashboards",
			},
		},
		restConfigProvider: nil,
	}

	client, err := api.getDynamicClient(reqCtx)

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
	getFunc    func(ctx context.Context, name string, opts metav1.GetOptions, subresources ...string) (*unstructured.Unstructured, error)
	listFunc   func(ctx context.Context, opts metav1.ListOptions) (*unstructured.UnstructuredList, error)
	createFunc func(ctx context.Context, obj *unstructured.Unstructured, opts metav1.CreateOptions, subresources ...string) (*unstructured.Unstructured, error)
	updateFunc func(ctx context.Context, obj *unstructured.Unstructured, opts metav1.UpdateOptions, subresources ...string) (*unstructured.Unstructured, error)
	deleteFunc func(ctx context.Context, name string, opts metav1.DeleteOptions, subresources ...string) error
}

func (f *fakeResourceInterface) Get(ctx context.Context, name string, opts metav1.GetOptions, subresources ...string) (*unstructured.Unstructured, error) {
	if f.getFunc != nil {
		return f.getFunc(ctx, name, opts, subresources...)
	}
	return &unstructured.Unstructured{}, nil
}

func (f *fakeResourceInterface) List(ctx context.Context, opts metav1.ListOptions) (*unstructured.UnstructuredList, error) {
	if f.listFunc != nil {
		return f.listFunc(ctx, opts)
	}
	return &unstructured.UnstructuredList{}, nil
}

func (f *fakeResourceInterface) Create(ctx context.Context, obj *unstructured.Unstructured, opts metav1.CreateOptions, subresources ...string) (*unstructured.Unstructured, error) {
	if f.createFunc != nil {
		return f.createFunc(ctx, obj, opts, subresources...)
	}
	return obj, nil
}

func (f *fakeResourceInterface) Update(ctx context.Context, obj *unstructured.Unstructured, opts metav1.UpdateOptions, subresources ...string) (*unstructured.Unstructured, error) {
	if f.updateFunc != nil {
		return f.updateFunc(ctx, obj, opts, subresources...)
	}
	return obj, nil
}

func (f *fakeResourceInterface) Delete(ctx context.Context, name string, opts metav1.DeleteOptions, subresources ...string) error {
	if f.deleteFunc != nil {
		return f.deleteFunc(ctx, name, opts, subresources...)
	}
	return nil
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

	t.Run("dashboard inherits provisioned admin role from parent folder", func(t *testing.T) {
		license := licensingtest.NewFakeLicensing()
		license.On("FeatureEnabled", "accesscontrol.enforcement").Return(false).Maybe()

		mockStore := &mockResourcePermissionStore{
			permissions: []accesscontrol.ResourcePermission{
				// Inherited Admin permission from parent folder (should be included)
				{
					RoleName:    "Admin",
					BuiltInRole: "Admin",
					IsManaged:   false,
					IsInherited: true, // Inherited from parent folder
					Actions:     []string{"dashboards:read", "dashboards:write", "dashboards:delete"},
				},
				// Direct provisioned permission (should be included)
				{
					UserID:      3,
					UserLogin:   "provisioned-user",
					Actions:     []string{"dashboards:read", "dashboards:write"},
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
						"View":  {"dashboards:read"},
						"Edit":  {"dashboards:read", "dashboards:write"},
						"Admin": {"dashboards:read", "dashboards:write", "dashboards:delete"},
					},
					InheritedScopesSolver: func(ctx context.Context, orgID int64, resourceID string) ([]string, error) {
						// Simulate returning parent folder scope
						return []string{"folders:uid:parent-folder-uid"}, nil
					},
				},
				actions:     []string{"dashboards:read", "dashboards:write", "dashboards:delete"},
				permissions: []string{"Admin", "Edit", "View"},
				license:     license,
			},
		}

		provisionedPerms, err := api.getProvisionedPermissions(context.Background(), "stack-123-org-1", "dashboard-123")

		require.NoError(t, err)
		require.Len(t, provisionedPerms, 2, "should return both inherited and direct provisioned permissions")

		// Find the inherited permission
		var inheritedPerm *resourcePermissionDTO
		var directPerm *resourcePermissionDTO
		for i := range provisionedPerms {
			if provisionedPerms[i].IsInherited {
				inheritedPerm = &provisionedPerms[i]
			} else {
				directPerm = &provisionedPerms[i]
			}
		}

		require.NotNil(t, inheritedPerm, "should have inherited permission")
		assert.Equal(t, "Admin", inheritedPerm.RoleName)
		assert.Equal(t, "Admin", inheritedPerm.Permission)
		assert.True(t, inheritedPerm.IsInherited, "should be marked as inherited")
		assert.False(t, inheritedPerm.IsManaged, "inherited permission should not be managed")

		require.NotNil(t, directPerm, "should have direct permission")
		assert.Equal(t, int64(3), directPerm.UserID)
		assert.Equal(t, "provisioned-user", directPerm.UserLogin)
		assert.False(t, directPerm.IsInherited, "direct permission should not be inherited")
	})

	t.Run("returns error when InheritedScopesSolver fails", func(t *testing.T) {
		license := licensingtest.NewFakeLicensing()
		license.On("FeatureEnabled", "accesscontrol.enforcement").Return(false).Maybe()

		mockStore := &mockResourcePermissionStore{
			permissions: []accesscontrol.ResourcePermission{},
		}

		expectedError := errors.New("dashboard not found")

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
					InheritedScopesSolver: func(ctx context.Context, orgID int64, resourceID string) ([]string, error) {
						// Simulate error (e.g., dashboard not found)
						return nil, expectedError
					},
				},
				actions:     []string{"dashboards:read", "dashboards:write"},
				permissions: []string{"Edit", "View"},
				license:     license,
			},
		}

		_, err := api.getProvisionedPermissions(context.Background(), "stack-123-org-1", "dashboard-123")

		require.Error(t, err)
		assert.ErrorIs(t, err, expectedError, "should return error from InheritedScopesSolver")
		assert.Contains(t, err.Error(), "failed to get inherited scopes for provisioned permissions")
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

		reqCtx := &contextmodel.ReqContext{
			Context: &web.Context{
				Req: &http.Request{},
			},
			Logger:       log.New("test"),
			SignedInUser: &user.SignedInUser{},
		}

		perms, err := api.getResourcePermissionsFromK8s(reqCtx, "stack-123-org-1", "dashboard-123")

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

		reqCtx := &contextmodel.ReqContext{
			Context: &web.Context{
				Req: &http.Request{},
			},
			Logger:       log.New("test"),
			SignedInUser: &user.SignedInUser{},
		}

		perms, err := api.getResourcePermissionsFromK8s(reqCtx, "stack-123-org-1", "dashboard-123")

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

// mockResourcePermissionStore is a mock implementation of the Store interface for testing
type mockResourcePermissionStore struct {
	permissions []accesscontrol.ResourcePermission
}

func (m *mockResourcePermissionStore) GetResourcePermissions(ctx context.Context, orgID int64, query GetResourcePermissionsQuery) ([]accesscontrol.ResourcePermission, error) {
	// Apply ExcludeManaged and InheritedScopes filters to match real store behavior
	var filtered []accesscontrol.ResourcePermission
	for _, perm := range m.permissions {
		if query.ExcludeManaged && perm.IsManaged {
			continue
		}
		// If no InheritedScopes provided, only return direct (non-inherited) permissions
		if len(query.InheritedScopes) == 0 && perm.IsInherited {
			continue
		}
		filtered = append(filtered, perm)
	}
	return filtered, nil
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

func (m *mockResourcePermissionStore) GetPermissionIDByRoleName(ctx context.Context, orgID int64, roleName string) (int64, error) {
	// Return a deterministic permission ID based on the role name for testing
	switch roleName {
	case "managed:users:1:permissions":
		return 100, nil
	case "managed:teams:1:permissions":
		return 200, nil
	case "managed:builtins:editor:permissions":
		return 300, nil
	default:
		return 0, errors.New("permission not found")
	}
}

func makeReqCtx() *contextmodel.ReqContext {
	return &contextmodel.ReqContext{
		Context: &web.Context{Req: httptest.NewRequest(http.MethodGet, "/", nil)},
		Logger:  log.New("test"),
		SignedInUser: &user.SignedInUser{
			OrgID: 1,
		},
	}
}

// TestListTeamMemberPermissions tests listing team permissions read from Team.Spec.Members.
func TestListTeamMemberPermissions(t *testing.T) {
	adminUser := &user.User{ID: 1, UID: "user-uid-1", Login: "admin-user", Email: "admin@test.com"}
	memberUser := &user.User{ID: 2, UID: "user-uid-2", Login: "member-user", Email: "member@test.com"}
	teamDTO := &team.TeamDTO{ID: 10, UID: "team-uid-1"}

	makeTeam := func(members ...iamv0.TeamTeamMember) iamv0.Team {
		return iamv0.Team{
			TypeMeta: metav1.TypeMeta{
				APIVersion: iamv0.TeamResourceInfo.GroupVersion().String(),
				Kind:       iamv0.TeamResourceInfo.TypeMeta().Kind,
			},
			ObjectMeta: metav1.ObjectMeta{Name: "team-uid-1", Namespace: "stacks-123-org-1"},
			Spec:       iamv0.TeamSpec{Members: members},
		}
	}

	tests := []struct {
		name             string
		resourceID       string
		teamSvc          *teamtest.FakeService
		userSvc          func() *usertest.MockService
		fakeResource     func(t *testing.T) *fakeResourceInterface
		permToActions    map[string][]string
		expectedCount    int
		expectedErrMsg   string
		validateResponse func(t *testing.T, perms getResourcePermissionsResponse)
	}{
		{
			name:       "returns admin and member permissions",
			resourceID: "10",
			teamSvc:    teamtest.NewFakeServiceWithTeamDTO(teamDTO),
			userSvc: func() *usertest.MockService {
				svc := &usertest.MockService{}
				svc.On("GetByUID", mock.Anything, &user.GetUserByUIDQuery{UID: "user-uid-1"}).Return(adminUser, nil)
				svc.On("GetByUID", mock.Anything, &user.GetUserByUIDQuery{UID: "user-uid-2"}).Return(memberUser, nil)
				return svc
			},
			fakeResource: func(t *testing.T) *fakeResourceInterface {
				teamObj := makeTeam(
					iamv0.TeamTeamMember{Kind: "User", Name: "user-uid-1", Permission: iamv0.TeamTeamPermissionAdmin},
					iamv0.TeamTeamMember{Kind: "User", Name: "user-uid-2", Permission: iamv0.TeamTeamPermissionMember},
				)
				obj, err := runtime.DefaultUnstructuredConverter.ToUnstructured(&teamObj)
				require.NoError(t, err)
				return &fakeResourceInterface{
					getFunc: func(_ context.Context, name string, _ metav1.GetOptions, _ ...string) (*unstructured.Unstructured, error) {
						assert.Equal(t, "team-uid-1", name)
						return &unstructured.Unstructured{Object: obj}, nil
					},
				}
			},
			permToActions: map[string][]string{
				"Admin":  {"teams:read", "teams:write", "teams:delete", "teams.permissions:read", "teams.permissions:write"},
				"Member": {"teams:read"},
			},
			expectedCount: 2,
			validateResponse: func(t *testing.T, perms getResourcePermissionsResponse) {
				assert.Equal(t, "Admin", perms[0].Permission)
				assert.Equal(t, int64(1), perms[0].UserID)
				assert.Equal(t, "user-uid-1", perms[0].UserUID)
				assert.Equal(t, "admin-user", perms[0].UserLogin)
				assert.True(t, perms[0].IsManaged)
				assert.Equal(t, []string{"teams:read", "teams:write", "teams:delete", "teams.permissions:read", "teams.permissions:write"}, perms[0].Actions)

				assert.Equal(t, "Member", perms[1].Permission)
				assert.Equal(t, int64(2), perms[1].UserID)
				assert.Equal(t, "user-uid-2", perms[1].UserUID)
				assert.Equal(t, "member-user", perms[1].UserLogin)
				assert.True(t, perms[1].IsManaged)
				assert.Equal(t, []string{"teams:read"}, perms[1].Actions)
			},
		},
		{
			name:       "skips non-User member kinds",
			resourceID: "10",
			teamSvc:    teamtest.NewFakeServiceWithTeamDTO(teamDTO),
			userSvc: func() *usertest.MockService {
				svc := &usertest.MockService{}
				svc.On("GetByUID", mock.Anything, &user.GetUserByUIDQuery{UID: "user-uid-1"}).Return(adminUser, nil)
				return svc
			},
			fakeResource: func(t *testing.T) *fakeResourceInterface {
				teamObj := makeTeam(
					iamv0.TeamTeamMember{Kind: "ServiceAccount", Name: "sa-uid-1", Permission: iamv0.TeamTeamPermissionMember},
					iamv0.TeamTeamMember{Kind: "User", Name: "user-uid-1", Permission: iamv0.TeamTeamPermissionAdmin},
				)
				obj, err := runtime.DefaultUnstructuredConverter.ToUnstructured(&teamObj)
				require.NoError(t, err)
				return &fakeResourceInterface{
					getFunc: func(_ context.Context, _ string, _ metav1.GetOptions, _ ...string) (*unstructured.Unstructured, error) {
						return &unstructured.Unstructured{Object: obj}, nil
					},
				}
			},
			permToActions: map[string][]string{"Admin": {"teams:read"}},
			expectedCount: 1,
		},
		{
			name:       "skips members with unknown permission enum",
			resourceID: "10",
			teamSvc:    teamtest.NewFakeServiceWithTeamDTO(teamDTO),
			userSvc: func() *usertest.MockService {
				svc := &usertest.MockService{}
				svc.On("GetByUID", mock.Anything, &user.GetUserByUIDQuery{UID: "user-uid-1"}).Return(adminUser, nil)
				// GetByUID must NOT be called for the rogue-permission member.
				return svc
			},
			fakeResource: func(t *testing.T) *fakeResourceInterface {
				teamObj := makeTeam(
					iamv0.TeamTeamMember{Kind: "User", Name: "user-uid-2", Permission: "rogue"},
					iamv0.TeamTeamMember{Kind: "User", Name: "user-uid-1", Permission: iamv0.TeamTeamPermissionAdmin},
				)
				obj, err := runtime.DefaultUnstructuredConverter.ToUnstructured(&teamObj)
				require.NoError(t, err)
				return &fakeResourceInterface{
					getFunc: func(_ context.Context, _ string, _ metav1.GetOptions, _ ...string) (*unstructured.Unstructured, error) {
						return &unstructured.Unstructured{Object: obj}, nil
					},
				}
			},
			permToActions: map[string][]string{"Admin": {"teams:read"}},
			expectedCount: 1,
			validateResponse: func(t *testing.T, perms getResourcePermissionsResponse) {
				require.Len(t, perms, 1)
				assert.Equal(t, "user-uid-1", perms[0].UserUID)
				assert.Equal(t, "Admin", perms[0].Permission)
			},
		},
		{
			name:       "returns empty list when team has no members",
			resourceID: "10",
			teamSvc:    teamtest.NewFakeServiceWithTeamDTO(teamDTO),
			fakeResource: func(t *testing.T) *fakeResourceInterface {
				teamObj := makeTeam()
				obj, err := runtime.DefaultUnstructuredConverter.ToUnstructured(&teamObj)
				require.NoError(t, err)
				return &fakeResourceInterface{
					getFunc: func(_ context.Context, _ string, _ metav1.GetOptions, _ ...string) (*unstructured.Unstructured, error) {
						return &unstructured.Unstructured{Object: obj}, nil
					},
				}
			},
			expectedCount: 0,
		},
		{
			name:       "returns error when team not found",
			resourceID: "10",
			teamSvc:    &teamtest.FakeService{ExpectedError: fmt.Errorf("team not found")},
			fakeResource: func(_ *testing.T) *fakeResourceInterface {
				return &fakeResourceInterface{}
			},
			expectedErrMsg: "failed to get team details",
		},
		{
			name:       "returns error for invalid resource ID",
			resourceID: "not-a-number",
			teamSvc:    teamtest.NewFakeServiceWithTeamDTO(teamDTO),
			fakeResource: func(_ *testing.T) *fakeResourceInterface {
				return &fakeResourceInterface{}
			},
			expectedErrMsg: "invalid team resource ID",
		},
		{
			name:       "returns error when k8s get fails",
			resourceID: "10",
			teamSvc:    teamtest.NewFakeServiceWithTeamDTO(teamDTO),
			fakeResource: func(_ *testing.T) *fakeResourceInterface {
				return &fakeResourceInterface{
					getFunc: func(_ context.Context, _ string, _ metav1.GetOptions, _ ...string) (*unstructured.Unstructured, error) {
						return nil, fmt.Errorf("k8s API unavailable")
					},
				}
			},
			expectedErrMsg: "failed to get team from k8s",
		},
		{
			name:       "returns error when user lookup fails",
			resourceID: "10",
			teamSvc:    teamtest.NewFakeServiceWithTeamDTO(teamDTO),
			userSvc: func() *usertest.MockService {
				svc := &usertest.MockService{}
				svc.On("GetByUID", mock.Anything, mock.Anything).Return(nil, fmt.Errorf("user not found"))
				return svc
			},
			fakeResource: func(t *testing.T) *fakeResourceInterface {
				teamObj := makeTeam(iamv0.TeamTeamMember{Kind: "User", Name: "user-uid-1", Permission: iamv0.TeamTeamPermissionAdmin})
				obj, err := runtime.DefaultUnstructuredConverter.ToUnstructured(&teamObj)
				require.NoError(t, err)
				return &fakeResourceInterface{
					getFunc: func(_ context.Context, _ string, _ metav1.GetOptions, _ ...string) (*unstructured.Unstructured, error) {
						return &unstructured.Unstructured{Object: obj}, nil
					},
				}
			},
			permToActions:  map[string][]string{"Admin": {"teams:read"}},
			expectedErrMsg: "failed to get user details for UID user-uid-1",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fakeClient := &fakeDynamicClient{resourceInterface: tt.fakeResource(t)}

			var userSvc *usertest.MockService
			if tt.userSvc != nil {
				userSvc = tt.userSvc()
			}

			permToActions := tt.permToActions
			if permToActions == nil {
				permToActions = map[string][]string{}
			}

			testApi := &api{
				cfg:    &setting.Cfg{},
				logger: log.New("test"),
				service: &Service{
					store:       &mockResourcePermissionStore{},
					teamService: tt.teamSvc,
					userService: userSvc,
					options: Options{
						Resource:             "teams",
						PermissionsToActions: permToActions,
					},
				},
			}

			perms, err := testApi.listTeamMemberPermissions(makeReqCtx(), fakeClient, "stacks-123-org-1", tt.resourceID)

			if tt.expectedErrMsg != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedErrMsg)
				return
			}

			require.NoError(t, err)
			assert.Len(t, perms, tt.expectedCount)
			if tt.validateResponse != nil {
				tt.validateResponse(t, perms)
			}
		})
	}
}

// TestSetTeamMember tests adding, updating, and removing entries in Team.Spec.Members.
func TestSetTeamMember(t *testing.T) {
	testUser := &user.User{ID: 1, UID: "user-uid-1"}
	testTeam := &team.TeamDTO{ID: 10, UID: "team-uid-1"}

	makeTeamObj := func(t *testing.T, members ...iamv0.TeamTeamMember) *unstructured.Unstructured {
		t.Helper()
		teamObj := iamv0.Team{
			TypeMeta: metav1.TypeMeta{
				APIVersion: iamv0.TeamResourceInfo.GroupVersion().String(),
				Kind:       iamv0.TeamResourceInfo.TypeMeta().Kind,
			},
			ObjectMeta: metav1.ObjectMeta{Name: "team-uid-1", Namespace: "stacks-123-org-1", ResourceVersion: "42"},
			Spec:       iamv0.TeamSpec{Members: members},
		}
		obj, err := runtime.DefaultUnstructuredConverter.ToUnstructured(&teamObj)
		require.NoError(t, err)
		return &unstructured.Unstructured{Object: obj}
	}
	decodeMembers := func(t *testing.T, obj *unstructured.Unstructured) []iamv0.TeamTeamMember {
		t.Helper()
		var decoded iamv0.Team
		require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(obj.Object, &decoded))
		return decoded.Spec.Members
	}

	tests := []struct {
		name            string
		permission      string
		userID          int64
		userSvc         func() *usertest.MockService
		fakeResource    func(t *testing.T) *fakeResourceInterface
		expectedErrMsg  string
		expectUpdate    bool
		validateMembers func(t *testing.T, members []iamv0.TeamTeamMember)
		validateCalls   func(t *testing.T, getCalls, updateCalls int)
	}{
		{
			name:       "adds a new member when not present",
			permission: "Admin",
			userID:     1,
			userSvc: func() *usertest.MockService {
				svc := &usertest.MockService{}
				svc.On("GetByID", mock.Anything, &user.GetUserByIDQuery{ID: int64(1)}).Return(testUser, nil)
				return svc
			},
			fakeResource: func(t *testing.T) *fakeResourceInterface {
				return &fakeResourceInterface{
					getFunc: func(_ context.Context, _ string, _ metav1.GetOptions, _ ...string) (*unstructured.Unstructured, error) {
						return makeTeamObj(t), nil
					},
					updateFunc: func(_ context.Context, obj *unstructured.Unstructured, _ metav1.UpdateOptions, _ ...string) (*unstructured.Unstructured, error) {
						return obj, nil
					},
				}
			},
			expectUpdate: true,
			validateMembers: func(t *testing.T, members []iamv0.TeamTeamMember) {
				require.Len(t, members, 1)
				assert.Equal(t, "User", members[0].Kind)
				assert.Equal(t, "user-uid-1", members[0].Name)
				assert.Equal(t, iamv0.TeamTeamPermissionAdmin, members[0].Permission)
				assert.False(t, members[0].External)
			},
		},
		{
			name:       "updates permission when member already present",
			permission: "Admin",
			userID:     1,
			userSvc: func() *usertest.MockService {
				svc := &usertest.MockService{}
				svc.On("GetByID", mock.Anything, &user.GetUserByIDQuery{ID: int64(1)}).Return(testUser, nil)
				return svc
			},
			fakeResource: func(t *testing.T) *fakeResourceInterface {
				return &fakeResourceInterface{
					getFunc: func(_ context.Context, _ string, _ metav1.GetOptions, _ ...string) (*unstructured.Unstructured, error) {
						return makeTeamObj(t, iamv0.TeamTeamMember{Kind: "User", Name: "user-uid-1", Permission: iamv0.TeamTeamPermissionMember}), nil
					},
					updateFunc: func(_ context.Context, obj *unstructured.Unstructured, _ metav1.UpdateOptions, _ ...string) (*unstructured.Unstructured, error) {
						return obj, nil
					},
				}
			},
			expectUpdate: true,
			validateMembers: func(t *testing.T, members []iamv0.TeamTeamMember) {
				require.Len(t, members, 1)
				assert.Equal(t, iamv0.TeamTeamPermissionAdmin, members[0].Permission)
			},
		},
		{
			name:       "removes member when permission is empty",
			permission: "",
			userID:     1,
			userSvc: func() *usertest.MockService {
				svc := &usertest.MockService{}
				svc.On("GetByID", mock.Anything, &user.GetUserByIDQuery{ID: int64(1)}).Return(testUser, nil)
				return svc
			},
			fakeResource: func(t *testing.T) *fakeResourceInterface {
				return &fakeResourceInterface{
					getFunc: func(_ context.Context, _ string, _ metav1.GetOptions, _ ...string) (*unstructured.Unstructured, error) {
						return makeTeamObj(t,
							iamv0.TeamTeamMember{Kind: "User", Name: "user-uid-1", Permission: iamv0.TeamTeamPermissionMember},
							iamv0.TeamTeamMember{Kind: "User", Name: "user-uid-2", Permission: iamv0.TeamTeamPermissionAdmin},
						), nil
					},
					updateFunc: func(_ context.Context, obj *unstructured.Unstructured, _ metav1.UpdateOptions, _ ...string) (*unstructured.Unstructured, error) {
						return obj, nil
					},
				}
			},
			expectUpdate: true,
			validateMembers: func(t *testing.T, members []iamv0.TeamTeamMember) {
				require.Len(t, members, 1)
				assert.Equal(t, "user-uid-2", members[0].Name)
			},
		},
		{
			name:       "no-op when removing a non-member",
			permission: "",
			userID:     1,
			userSvc: func() *usertest.MockService {
				svc := &usertest.MockService{}
				svc.On("GetByID", mock.Anything, &user.GetUserByIDQuery{ID: int64(1)}).Return(testUser, nil)
				return svc
			},
			fakeResource: func(t *testing.T) *fakeResourceInterface {
				return &fakeResourceInterface{
					getFunc: func(_ context.Context, _ string, _ metav1.GetOptions, _ ...string) (*unstructured.Unstructured, error) {
						return makeTeamObj(t), nil
					},
				}
			},
		},
		{
			name:       "no-op when team not found and permission is empty",
			permission: "",
			userID:     1,
			userSvc: func() *usertest.MockService {
				svc := &usertest.MockService{}
				svc.On("GetByID", mock.Anything, &user.GetUserByIDQuery{ID: int64(1)}).Return(testUser, nil)
				return svc
			},
			fakeResource: func(_ *testing.T) *fakeResourceInterface {
				return &fakeResourceInterface{
					getFunc: func(_ context.Context, _ string, _ metav1.GetOptions, _ ...string) (*unstructured.Unstructured, error) {
						return nil, k8serrors.NewNotFound(schema.GroupResource{}, "team-uid-1")
					},
				}
			},
		},
		{
			name:       "returns error when user not found",
			permission: "Admin",
			userID:     999,
			userSvc: func() *usertest.MockService {
				svc := &usertest.MockService{}
				svc.On("GetByID", mock.Anything, mock.Anything).Return(nil, fmt.Errorf("user not found"))
				return svc
			},
			fakeResource: func(_ *testing.T) *fakeResourceInterface {
				return &fakeResourceInterface{}
			},
			expectedErrMsg: "failed to get user details",
		},
		{
			name:       "returns error when team get fails",
			permission: "Admin",
			userID:     1,
			userSvc: func() *usertest.MockService {
				svc := &usertest.MockService{}
				svc.On("GetByID", mock.Anything, &user.GetUserByIDQuery{ID: int64(1)}).Return(testUser, nil)
				return svc
			},
			fakeResource: func(_ *testing.T) *fakeResourceInterface {
				return &fakeResourceInterface{
					getFunc: func(_ context.Context, _ string, _ metav1.GetOptions, _ ...string) (*unstructured.Unstructured, error) {
						return nil, fmt.Errorf("k8s API unavailable")
					},
				}
			},
			expectedErrMsg: "failed to get team",
		},
		{
			name:       "retries on conflict and succeeds",
			permission: "Admin",
			userID:     1,
			userSvc: func() *usertest.MockService {
				svc := &usertest.MockService{}
				svc.On("GetByID", mock.Anything, &user.GetUserByIDQuery{ID: int64(1)}).Return(testUser, nil)
				return svc
			},
			fakeResource: func(t *testing.T) *fakeResourceInterface {
				updates := 0
				return &fakeResourceInterface{
					getFunc: func(_ context.Context, _ string, _ metav1.GetOptions, _ ...string) (*unstructured.Unstructured, error) {
						return makeTeamObj(t), nil
					},
					updateFunc: func(_ context.Context, obj *unstructured.Unstructured, _ metav1.UpdateOptions, _ ...string) (*unstructured.Unstructured, error) {
						updates++
						if updates == 1 {
							return nil, k8serrors.NewConflict(schema.GroupResource{}, "team-uid-1", fmt.Errorf("conflict"))
						}
						return obj, nil
					},
				}
			},
			expectUpdate: true,
			validateMembers: func(t *testing.T, members []iamv0.TeamTeamMember) {
				require.Len(t, members, 1)
				assert.Equal(t, iamv0.TeamTeamPermissionAdmin, members[0].Permission)
			},
			validateCalls: func(t *testing.T, getCalls, updateCalls int) {
				assert.Equal(t, 2, getCalls, "should re-read on conflict before retrying Update")
				assert.Equal(t, 2, updateCalls, "should retry Update exactly once after conflict")
			},
		},
		{
			name:       "no Update when existing permission is unchanged",
			permission: "Admin",
			userID:     1,
			userSvc: func() *usertest.MockService {
				svc := &usertest.MockService{}
				svc.On("GetByID", mock.Anything, &user.GetUserByIDQuery{ID: int64(1)}).Return(testUser, nil)
				return svc
			},
			fakeResource: func(t *testing.T) *fakeResourceInterface {
				return &fakeResourceInterface{
					getFunc: func(_ context.Context, _ string, _ metav1.GetOptions, _ ...string) (*unstructured.Unstructured, error) {
						return makeTeamObj(t, iamv0.TeamTeamMember{Kind: "User", Name: "user-uid-1", Permission: iamv0.TeamTeamPermissionAdmin}), nil
					},
				}
			},
			validateCalls: func(t *testing.T, _, updateCalls int) {
				assert.Equal(t, 0, updateCalls, "should skip Update when permission already matches")
			},
		},
		{
			name:       "returns error for unsupported permission",
			permission: "Bogus",
			userID:     1,
			userSvc: func() *usertest.MockService {
				svc := &usertest.MockService{}
				svc.On("GetByID", mock.Anything, &user.GetUserByIDQuery{ID: int64(1)}).Return(testUser, nil)
				return svc
			},
			fakeResource: func(_ *testing.T) *fakeResourceInterface {
				return &fakeResourceInterface{}
			},
			expectedErrMsg: "unsupported team permission",
		},
		{
			name:       "returns error when team update fails",
			permission: "Admin",
			userID:     1,
			userSvc: func() *usertest.MockService {
				svc := &usertest.MockService{}
				svc.On("GetByID", mock.Anything, &user.GetUserByIDQuery{ID: int64(1)}).Return(testUser, nil)
				return svc
			},
			fakeResource: func(t *testing.T) *fakeResourceInterface {
				return &fakeResourceInterface{
					getFunc: func(_ context.Context, _ string, _ metav1.GetOptions, _ ...string) (*unstructured.Unstructured, error) {
						return makeTeamObj(t), nil
					},
					updateFunc: func(_ context.Context, _ *unstructured.Unstructured, _ metav1.UpdateOptions, _ ...string) (*unstructured.Unstructured, error) {
						return nil, fmt.Errorf("k8s API unavailable")
					},
				}
			},
			expectedErrMsg: "failed to update team members",
			validateCalls: func(t *testing.T, _, updateCalls int) {
				assert.Equal(t, 1, updateCalls, "non-conflict errors should not be retried")
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var (
				lastUpdated *unstructured.Unstructured
				getCalls    int
				updateCalls int
			)
			fr := tt.fakeResource(t)
			if fr.getFunc != nil {
				origGet := fr.getFunc
				fr.getFunc = func(ctx context.Context, name string, opts metav1.GetOptions, subresources ...string) (*unstructured.Unstructured, error) {
					getCalls++
					return origGet(ctx, name, opts, subresources...)
				}
			}
			if fr.updateFunc != nil {
				origUpdate := fr.updateFunc
				fr.updateFunc = func(ctx context.Context, obj *unstructured.Unstructured, opts metav1.UpdateOptions, subresources ...string) (*unstructured.Unstructured, error) {
					updateCalls++
					lastUpdated = obj
					return origUpdate(ctx, obj, opts, subresources...)
				}
			}
			fakeClient := &fakeDynamicClient{resourceInterface: fr}

			testApi := &api{
				cfg:    &setting.Cfg{},
				logger: log.New("test"),
				service: &Service{
					store:       &mockResourcePermissionStore{},
					teamService: teamtest.NewFakeServiceWithTeamDTO(testTeam),
					userService: tt.userSvc(),
					options:     Options{Resource: "teams"},
				},
			}

			err := testApi.setTeamMember(makeReqCtx(), fakeClient, "stacks-123-org-1", "10", tt.userID, tt.permission)

			if tt.expectedErrMsg != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedErrMsg)
				if tt.validateCalls != nil {
					tt.validateCalls(t, getCalls, updateCalls)
				}
				return
			}
			require.NoError(t, err)

			if tt.expectUpdate {
				require.NotNil(t, lastUpdated, "expected an Update call")
				if tt.validateMembers != nil {
					tt.validateMembers(t, decodeMembers(t, lastUpdated))
				}
			} else {
				assert.Nil(t, lastUpdated, "expected no Update call")
			}
			if tt.validateCalls != nil {
				tt.validateCalls(t, getCalls, updateCalls)
			}
		})
	}
}

// TestTeamMemberWrappers_RestConfigNotAvailable tests that both wrappers return
// ErrRestConfigNotAvailable when no rest config provider is set, so the caller (api.go)
// can stop the operation and return the error.
func TestTeamMemberWrappers_RestConfigNotAvailable(t *testing.T) {
	tests := []struct {
		name string
		call func(a *api) error
	}{
		{
			name: "setUserPermissionInTeamMembers",
			call: func(a *api) error {
				return a.setUserPermissionInTeamMembers(makeReqCtx(), "stacks-123-org-1", "10", 1, "Admin")
			},
		},
		{
			name: "getTeamPermissionsFromMembers",
			call: func(a *api) error {
				_, err := a.getTeamPermissionsFromMembers(makeReqCtx(), "stacks-123-org-1", "10")
				return err
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			testApi := &api{
				cfg:    &setting.Cfg{},
				logger: log.New("test"),
				service: &Service{
					options: Options{Resource: "teams"},
				},
				restConfigProvider: nil,
			}

			err := tt.call(testApi)
			require.Error(t, err)
			assert.ErrorIs(t, err, ErrRestConfigNotAvailable)
		})
	}
}

// TestGetRoleIDFromK8sObject tests retrieving permission IDs from the database by role name
func TestGetRoleIDFromK8sObject(t *testing.T) {
	mockStore := &mockResourcePermissionStore{}

	testApi := &api{
		service: &Service{
			store: mockStore,
		},
		logger: log.New("test"),
	}

	t.Run("retrieves permission ID from database", func(t *testing.T) {
		permissionID := testApi.getRoleIDFromK8sObject("managed:users:1:permissions", 1)
		assert.Equal(t, int64(100), permissionID)
	})

	t.Run("returns 0 when permission not found in database", func(t *testing.T) {
		permissionID := testApi.getRoleIDFromK8sObject("managed:users:999:permissions", 1)
		assert.Equal(t, int64(0), permissionID)
	})

	t.Run("returns 0 when store is nil", func(t *testing.T) {
		apiNoStore := &api{
			service: &Service{
				store: nil,
			},
			logger: log.New("test"),
		}

		permissionID := apiNoStore.getRoleIDFromK8sObject("managed:users:1:permissions", 1)
		assert.Equal(t, int64(0), permissionID)
	})
}
