package annotation

import (
	"context"
	"errors"
	"testing"

	authlib "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/endpoints/request"

	annotationV0 "github.com/grafana/grafana/apps/annotation/pkg/apis/annotation/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/dashboards"
)

// Mock implementations

type mockAccessClient struct {
	checkFunc func(ctx context.Context, id authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error)
}

func (m *mockAccessClient) Check(ctx context.Context, id authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
	if m.checkFunc != nil {
		return m.checkFunc(ctx, id, req, folder)
	}
	return authlib.CheckResponse{Allowed: false}, nil
}

func (m *mockAccessClient) Compile(ctx context.Context, id authlib.AuthInfo, req authlib.ListRequest) (authlib.ItemChecker, authlib.Zookie, error) {
	return nil, authlib.NoopZookie{}, errors.New("not implemented")
}

func (m *mockAccessClient) BatchCheck(ctx context.Context, id authlib.AuthInfo, req authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
	return authlib.BatchCheckResponse{}, errors.New("not implemented")
}

// mockDashboardGetter implements only the GetDashboard method we need for testing
type mockDashboardGetter struct {
	getDashboardFunc func(ctx context.Context, query *dashboards.GetDashboardQuery) (*dashboards.Dashboard, error)
}

func (m *mockDashboardGetter) GetDashboard(ctx context.Context, query *dashboards.GetDashboardQuery) (*dashboards.Dashboard, error) {
	if m.getDashboardFunc != nil {
		return m.getDashboardFunc(ctx, query)
	}
	return nil, errors.New("dashboard not found")
}

// mockDashStore wraps mockDashboardGetter and provides stub implementations for all other Store methods
type mockDashStore struct {
	*mockDashboardGetter
}

func newMockDashStore(getter *mockDashboardGetter) dashboards.Store {
	return &mockDashStore{mockDashboardGetter: getter}
}

// Stub implementations of dashboards.Store interface
func (m *mockDashStore) DeleteDashboard(ctx context.Context, cmd *dashboards.DeleteDashboardCommand) error {
	return errors.New("not implemented")
}

func (m *mockDashStore) CleanupAfterDelete(ctx context.Context, cmd *dashboards.DeleteDashboardCommand) error {
	return nil
}

func (m *mockDashStore) FindDashboards(ctx context.Context, query *dashboards.FindPersistedDashboardsQuery) ([]dashboards.DashboardSearchProjection, error) {
	return nil, errors.New("not implemented")
}

func (m *mockDashStore) GetDashboardsByPluginID(ctx context.Context, query *dashboards.GetDashboardsByPluginIDQuery) ([]*dashboards.Dashboard, error) {
	return nil, errors.New("not implemented")
}

func (m *mockDashStore) GetDashboardTags(ctx context.Context, query *dashboards.GetDashboardTagsQuery) ([]*dashboards.DashboardTagCloudItem, error) {
	return nil, errors.New("not implemented")
}

func (m *mockDashStore) GetProvisionedDashboardData(ctx context.Context, name string) ([]*dashboards.DashboardProvisioning, error) {
	return nil, errors.New("not implemented")
}

func (m *mockDashStore) GetProvisionedDataByDashboardID(ctx context.Context, dashboardID int64) (*dashboards.DashboardProvisioningSearchResults, error) {
	return nil, errors.New("not implemented")
}

func (m *mockDashStore) GetProvisionedDataByDashboardUID(ctx context.Context, orgID int64, dashboardUID string) (*dashboards.DashboardProvisioningSearchResults, error) {
	return nil, errors.New("not implemented")
}

func (m *mockDashStore) GetProvisionedDashboardsByName(ctx context.Context, name string, orgID int64) ([]*dashboards.DashboardProvisioningSearchResults, error) {
	return nil, errors.New("not implemented")
}

func (m *mockDashStore) GetOrphanedProvisionedDashboards(ctx context.Context, notIn []string, orgID int64) ([]*dashboards.Dashboard, error) {
	return nil, errors.New("not implemented")
}

func (m *mockDashStore) GetDuplicateProvisionedDashboards(ctx context.Context) ([]*dashboards.DashboardProvisioningSearchResults, error) {
	return nil, errors.New("not implemented")
}

func (m *mockDashStore) SaveDashboard(ctx context.Context, cmd dashboards.SaveDashboardCommand) (*dashboards.Dashboard, error) {
	return nil, errors.New("not implemented")
}

func (m *mockDashStore) SaveProvisionedDashboard(ctx context.Context, cmd dashboards.SaveDashboardCommand, provisioning *dashboards.DashboardProvisioning) (*dashboards.Dashboard, error) {
	return nil, errors.New("not implemented")
}

func (m *mockDashStore) UnprovisionDashboard(ctx context.Context, id int64) error {
	return errors.New("not implemented")
}

func (m *mockDashStore) ValidateDashboardBeforeSave(ctx context.Context, dashboard *dashboards.Dashboard, overwrite bool) (bool, error) {
	return false, errors.New("not implemented")
}

func (m *mockDashStore) CountInOrg(ctx context.Context, orgID int64, isFolder bool) (int64, error) {
	return 0, errors.New("not implemented")
}

func (m *mockDashStore) DeleteDashboardsInFolders(ctx context.Context, request *dashboards.DeleteDashboardsInFolderRequest) error {
	return errors.New("not implemented")
}

func (m *mockDashStore) GetAllDashboardsByOrgId(ctx context.Context, orgID int64) ([]*dashboards.Dashboard, error) {
	return nil, errors.New("not implemented")
}

func (m *mockDashStore) GetDashboardsByLibraryPanelUID(ctx context.Context, libraryPanelUID string, orgID int64) ([]*dashboards.DashboardRef, error) {
	return nil, errors.New("not implemented")
}

// Helper functions

func setupTestContext(t *testing.T, orgID int64) context.Context {
	t.Helper()
	ctx := context.Background()

	// Add namespace using k8s request package
	namespace := authlib.CloudNamespaceFormatter(orgID)
	ctx = request.WithNamespace(ctx, namespace)

	// Add auth info
	authInfo := &identity.StaticRequester{
		Type:           "user",
		Login:          "test-user",
		UserID:         1,
		UserUID:        "user-1",
		OrgID:          orgID,
		OrgRole:        "Viewer",
		IsGrafanaAdmin: false,
	}
	ctx = authlib.WithAuthInfo(ctx, authInfo)
	ctx = identity.WithRequester(ctx, authInfo)

	return ctx
}

func createAuthzTestAnnotation(dashboardUID *string) *annotationV0.Annotation {
	ann := &annotationV0.Annotation{}
	ann.Name = "test-annotation-1"
	ann.Namespace = "stack-1"
	ann.Spec.Text = "Test annotation"
	ann.Spec.DashboardUID = dashboardUID
	return ann
}

// Test canRead

func TestAnnotationAuthorizer_CanRead_OrgLevelAnnotation(t *testing.T) {
	ctx := setupTestContext(t, 1)

	accessClient := &mockAccessClient{
		checkFunc: func(ctx context.Context, id authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
			// Verify request parameters
			assert.Equal(t, utils.VerbGet, req.Verb)
			assert.Equal(t, "annotation.grafana.app", req.Group)
			assert.Equal(t, "annotations", req.Resource)
			assert.Equal(t, "", folder) // Org-level annotation has no folder

			return authlib.CheckResponse{Allowed: true}, nil
		},
	}

	dashStore := newMockDashStore(&mockDashboardGetter{})
	authorizer := newAnnotationAuthorizer(accessClient, dashStore)

	// Test org-level annotation (no dashboard UID)
	annotation := createAuthzTestAnnotation(nil)

	allowed, err := authorizer.canRead(ctx, nil, annotation)
	require.NoError(t, err)
	assert.True(t, allowed)
}

func TestAnnotationAuthorizer_CanRead_DashboardAnnotation_DirectPermission(t *testing.T) {
	ctx := setupTestContext(t, 1)
	dashboardUID := "dash-1"

	accessClient := &mockAccessClient{
		checkFunc: func(ctx context.Context, id authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
			assert.Equal(t, utils.VerbGet, req.Verb)
			assert.Equal(t, "folder-1", folder) // Folder should be looked up
			return authlib.CheckResponse{Allowed: true}, nil
		},
	}

	dashStore := newMockDashStore(&mockDashboardGetter{
		getDashboardFunc: func(ctx context.Context, query *dashboards.GetDashboardQuery) (*dashboards.Dashboard, error) {
			assert.Equal(t, int64(1), query.OrgID)
			assert.Equal(t, dashboardUID, query.UID)
			return &dashboards.Dashboard{
				UID:       dashboardUID,
				FolderUID: "folder-1",
			}, nil
		},
	})

	authorizer := newAnnotationAuthorizer(accessClient, dashStore)
	annotation := createAuthzTestAnnotation(&dashboardUID)

	allowed, err := authorizer.canRead(ctx, nil, annotation)
	require.NoError(t, err)
	assert.True(t, allowed)
}

func TestAnnotationAuthorizer_CanRead_DashboardAnnotation_FolderPermission(t *testing.T) {
	ctx := setupTestContext(t, 1)
	dashboardUID := "dash-in-folder"

	// This test simulates a user with folder-level permission
	// The accessClient.Check will be called with the folder parameter,
	// allowing the authorization system to check folder permissions
	accessClient := &mockAccessClient{
		checkFunc: func(ctx context.Context, id authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
			// Verify folder is passed correctly
			assert.Equal(t, "folder-x", folder)

			// In reality, the accessClient would resolve this to check:
			// - annotations:read on dashboards:uid:dash-in-folder
			// - annotations:read on folders:uid:folder-x
			// Here we simulate that the folder permission grants access
			return authlib.CheckResponse{Allowed: true}, nil
		},
	}

	dashStore := newMockDashStore(&mockDashboardGetter{
		getDashboardFunc: func(ctx context.Context, query *dashboards.GetDashboardQuery) (*dashboards.Dashboard, error) {
			return &dashboards.Dashboard{
				UID:       dashboardUID,
				FolderUID: "folder-x",
			}, nil
		},
	})

	authorizer := newAnnotationAuthorizer(accessClient, dashStore)
	annotation := createAuthzTestAnnotation(&dashboardUID)

	allowed, err := authorizer.canRead(ctx, nil, annotation)
	require.NoError(t, err)
	assert.True(t, allowed, "User with folder permission should be able to read annotation")
}

func TestAnnotationAuthorizer_CanRead_NoPermission(t *testing.T) {
	ctx := setupTestContext(t, 1)
	dashboardUID := "dash-1"

	accessClient := &mockAccessClient{
		checkFunc: func(ctx context.Context, id authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
			// Deny access
			return authlib.CheckResponse{Allowed: false}, nil
		},
	}

	dashStore := newMockDashStore(&mockDashboardGetter{
		getDashboardFunc: func(ctx context.Context, query *dashboards.GetDashboardQuery) (*dashboards.Dashboard, error) {
			return &dashboards.Dashboard{
				UID:       dashboardUID,
				FolderUID: "folder-1",
			}, nil
		},
	})

	authorizer := newAnnotationAuthorizer(accessClient, dashStore)
	annotation := createAuthzTestAnnotation(&dashboardUID)

	allowed, err := authorizer.canRead(ctx, nil, annotation)
	require.NoError(t, err)
	assert.False(t, allowed, "User without permission should not be able to read annotation")
}

func TestAnnotationAuthorizer_CanRead_DashboardNotFound(t *testing.T) {
	ctx := setupTestContext(t, 1)
	dashboardUID := "nonexistent-dash"

	accessClient := &mockAccessClient{
		checkFunc: func(ctx context.Context, id authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
			// Folder should be empty since dashboard lookup failed
			assert.Equal(t, "", folder)

			// User might still have direct dashboard permission
			return authlib.CheckResponse{Allowed: true}, nil
		},
	}

	dashStore := newMockDashStore(&mockDashboardGetter{
		getDashboardFunc: func(ctx context.Context, query *dashboards.GetDashboardQuery) (*dashboards.Dashboard, error) {
			return nil, errors.New("dashboard not found")
		},
	})

	authorizer := newAnnotationAuthorizer(accessClient, dashStore)
	annotation := createAuthzTestAnnotation(&dashboardUID)

	// Should still check permissions even if dashboard lookup fails
	allowed, err := authorizer.canRead(ctx, nil, annotation)
	require.NoError(t, err)
	assert.True(t, allowed)
}

// Test canCreate and canUpdate

func TestAnnotationAuthorizer_CanCreate_Success(t *testing.T) {
	ctx := setupTestContext(t, 1)
	dashboardUID := "dash-1"

	accessClient := &mockAccessClient{
		checkFunc: func(ctx context.Context, id authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
			assert.Equal(t, utils.VerbCreate, req.Verb)
			assert.Equal(t, "folder-1", folder)
			return authlib.CheckResponse{Allowed: true}, nil
		},
	}

	dashStore := newMockDashStore(&mockDashboardGetter{
		getDashboardFunc: func(ctx context.Context, query *dashboards.GetDashboardQuery) (*dashboards.Dashboard, error) {
			return &dashboards.Dashboard{
				UID:       dashboardUID,
				FolderUID: "folder-1",
			}, nil
		},
	})

	authorizer := newAnnotationAuthorizer(accessClient, dashStore)
	annotation := createAuthzTestAnnotation(&dashboardUID)

	allowed, err := authorizer.canCreate(ctx, nil, annotation)
	require.NoError(t, err)
	assert.True(t, allowed)
}

func TestAnnotationAuthorizer_CanCreate_NoPermission(t *testing.T) {
	ctx := setupTestContext(t, 1)
	dashboardUID := "dash-1"

	accessClient := &mockAccessClient{
		checkFunc: func(ctx context.Context, id authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
			return authlib.CheckResponse{Allowed: false}, nil
		},
	}

	dashStore := newMockDashStore(&mockDashboardGetter{
		getDashboardFunc: func(ctx context.Context, query *dashboards.GetDashboardQuery) (*dashboards.Dashboard, error) {
			return &dashboards.Dashboard{UID: dashboardUID, FolderUID: "folder-1"}, nil
		},
	})

	authorizer := newAnnotationAuthorizer(accessClient, dashStore)
	annotation := createAuthzTestAnnotation(&dashboardUID)

	allowed, err := authorizer.canCreate(ctx, nil, annotation)
	require.NoError(t, err)
	assert.False(t, allowed)
}

func TestAnnotationAuthorizer_CanUpdate_Success(t *testing.T) {
	ctx := setupTestContext(t, 1)
	dashboardUID := "dash-1"

	accessClient := &mockAccessClient{
		checkFunc: func(ctx context.Context, id authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
			assert.Equal(t, utils.VerbUpdate, req.Verb)
			assert.Equal(t, "folder-1", folder)
			return authlib.CheckResponse{Allowed: true}, nil
		},
	}

	dashStore := newMockDashStore(&mockDashboardGetter{
		getDashboardFunc: func(ctx context.Context, query *dashboards.GetDashboardQuery) (*dashboards.Dashboard, error) {
			return &dashboards.Dashboard{
				UID:       dashboardUID,
				FolderUID: "folder-1",
			}, nil
		},
	})

	authorizer := newAnnotationAuthorizer(accessClient, dashStore)
	annotation := createAuthzTestAnnotation(&dashboardUID)

	allowed, err := authorizer.canUpdate(ctx, nil, annotation)
	require.NoError(t, err)
	assert.True(t, allowed)
}

func TestAnnotationAuthorizer_CanUpdate_NoPermission(t *testing.T) {
	ctx := setupTestContext(t, 1)
	dashboardUID := "dash-1"

	accessClient := &mockAccessClient{
		checkFunc: func(ctx context.Context, id authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
			return authlib.CheckResponse{Allowed: false}, nil
		},
	}

	dashStore := newMockDashStore(&mockDashboardGetter{
		getDashboardFunc: func(ctx context.Context, query *dashboards.GetDashboardQuery) (*dashboards.Dashboard, error) {
			return &dashboards.Dashboard{UID: dashboardUID, FolderUID: "folder-1"}, nil
		},
	})

	authorizer := newAnnotationAuthorizer(accessClient, dashStore)
	annotation := createAuthzTestAnnotation(&dashboardUID)

	allowed, err := authorizer.canUpdate(ctx, nil, annotation)
	require.NoError(t, err)
	assert.False(t, allowed)
}

// Test canDelete

func TestAnnotationAuthorizer_CanDelete_Success(t *testing.T) {
	ctx := setupTestContext(t, 1)
	dashboardUID := "dash-1"

	accessClient := &mockAccessClient{
		checkFunc: func(ctx context.Context, id authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
			assert.Equal(t, utils.VerbDelete, req.Verb)
			return authlib.CheckResponse{Allowed: true}, nil
		},
	}

	dashStore := newMockDashStore(&mockDashboardGetter{
		getDashboardFunc: func(ctx context.Context, query *dashboards.GetDashboardQuery) (*dashboards.Dashboard, error) {
			return &dashboards.Dashboard{UID: dashboardUID, FolderUID: "folder-1"}, nil
		},
	})

	authorizer := newAnnotationAuthorizer(accessClient, dashStore)
	annotation := createAuthzTestAnnotation(&dashboardUID)

	allowed, err := authorizer.canDelete(ctx, nil, annotation)
	require.NoError(t, err)
	assert.True(t, allowed)
}

// Test filterReadable

func TestAnnotationAuthorizer_FilterReadable_MixedPermissions(t *testing.T) {
	ctx := setupTestContext(t, 1)

	// Set up test data: 3 annotations on different dashboards
	dash1UID := "dash-1"
	dash2UID := "dash-2"
	dash3UID := "dash-3"

	annotations := []annotationV0.Annotation{
		*createAuthzTestAnnotation(&dash1UID),
		*createAuthzTestAnnotation(&dash2UID),
		*createAuthzTestAnnotation(&dash3UID),
		*createAuthzTestAnnotation(nil), // org-level annotation
	}

	// Track which dashboards were looked up (should be cached)
	dashboardLookups := make(map[string]int)

	accessClient := &mockAccessClient{
		checkFunc: func(ctx context.Context, id authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
			// Allow access to dash-1 and dash-3, deny dash-2
			// Allow org-level annotations
			if folder == "folder-1" || folder == "folder-3" || folder == "" {
				return authlib.CheckResponse{Allowed: true}, nil
			}
			return authlib.CheckResponse{Allowed: false}, nil
		},
	}

	dashStore := newMockDashStore(&mockDashboardGetter{
		getDashboardFunc: func(ctx context.Context, query *dashboards.GetDashboardQuery) (*dashboards.Dashboard, error) {
			dashboardLookups[query.UID]++

			switch query.UID {
			case dash1UID:
				return &dashboards.Dashboard{UID: dash1UID, FolderUID: "folder-1"}, nil
			case dash2UID:
				return &dashboards.Dashboard{UID: dash2UID, FolderUID: "folder-2"}, nil
			case dash3UID:
				return &dashboards.Dashboard{UID: dash3UID, FolderUID: "folder-3"}, nil
			default:
				return nil, errors.New("not found")
			}
		},
	})

	authorizer := newAnnotationAuthorizer(accessClient, dashStore)

	filtered, err := authorizer.filterReadable(ctx, nil, annotations)
	require.NoError(t, err)

	// Should return dash-1, dash-3, and org-level annotation (3 total)
	assert.Len(t, filtered, 3, "Should filter out dash-2 annotation")

	// Verify each dashboard was only looked up once (caching works)
	assert.Equal(t, 1, dashboardLookups[dash1UID], "dash-1 should be looked up once")
	assert.Equal(t, 1, dashboardLookups[dash2UID], "dash-2 should be looked up once")
	assert.Equal(t, 1, dashboardLookups[dash3UID], "dash-3 should be looked up once")
}

func TestAnnotationAuthorizer_FilterReadable_EmptyList(t *testing.T) {
	ctx := setupTestContext(t, 1)

	accessClient := &mockAccessClient{}
	dashStore := newMockDashStore(&mockDashboardGetter{})
	authorizer := newAnnotationAuthorizer(accessClient, dashStore)

	filtered, err := authorizer.filterReadable(ctx, nil, []annotationV0.Annotation{})
	require.NoError(t, err)
	assert.Empty(t, filtered)
}

func TestAnnotationAuthorizer_FilterReadable_CachingOptimization(t *testing.T) {
	ctx := setupTestContext(t, 1)

	// Create multiple annotations on the same dashboard
	dashUID := "dash-1"
	annotations := []annotationV0.Annotation{
		*createAuthzTestAnnotation(&dashUID),
		*createAuthzTestAnnotation(&dashUID),
		*createAuthzTestAnnotation(&dashUID),
	}

	lookupCount := 0

	dashStore := newMockDashStore(&mockDashboardGetter{
		getDashboardFunc: func(ctx context.Context, query *dashboards.GetDashboardQuery) (*dashboards.Dashboard, error) {
			lookupCount++
			return &dashboards.Dashboard{UID: dashUID, FolderUID: "folder-1"}, nil
		},
	})

	accessClient := &mockAccessClient{
		checkFunc: func(ctx context.Context, id authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
			return authlib.CheckResponse{Allowed: true}, nil
		},
	}

	authorizer := newAnnotationAuthorizer(accessClient, dashStore)

	filtered, err := authorizer.filterReadable(ctx, nil, annotations)
	require.NoError(t, err)
	assert.Len(t, filtered, 3)

	// Dashboard should only be looked up once despite 3 annotations
	assert.Equal(t, 1, lookupCount, "Dashboard should be cached and only looked up once")
}
