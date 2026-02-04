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
