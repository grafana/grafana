package export

import (
	"context"
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	mock "github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	provisioningV0 "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

// Helper function to create a repository config with folder sync target
func createFolderSyncRepository() *provisioningV0.Repository {
	return &provisioningV0.Repository{
		Spec: provisioningV0.RepositorySpec{
			Sync: provisioningV0.SyncOptions{
				Target: provisioningV0.SyncTargetTypeFolder,
			},
		},
	}
}

// Helper function to create a repository config with instance sync target
func createInstanceSyncRepository() *provisioningV0.Repository {
	return &provisioningV0.Repository{
		Spec: provisioningV0.RepositorySpec{
			Sync: provisioningV0.SyncOptions{
				Target: provisioningV0.SyncTargetTypeInstance,
			},
		},
	}
}

// Helper function to create folder objects
func createFolderObject(name, uid, parentFolderUID string) unstructured.Unstructured {
	folder := unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": resources.FolderResource.GroupVersion().String(),
			"kind":       "Folder",
			"metadata": map[string]interface{}{
				"name": name,
				"uid":  uid,
			},
			"spec": map[string]interface{}{
				"title": name,
			},
		},
	}
	if parentFolderUID != "" {
		meta, _ := utils.MetaAccessor(&folder)
		meta.SetFolder(parentFolderUID)
	}
	return folder
}

// Helper function to create dashboard objects with folder
func createDashboardObjectWithFolder(name, folderID string) unstructured.Unstructured {
	dashboard := createDashboardObject(name)
	if folderID != "" {
		meta, _ := utils.MetaAccessor(&dashboard)
		meta.SetFolder(folderID)
	}
	return dashboard
}

// Helper function to run ExportSpecificResources test
func runExportSpecificResourcesTest(t *testing.T, repoConfig *provisioningV0.Repository, resourceRefs []provisioningV0.ResourceRef, folderItems []unstructured.Unstructured, setupProgress func(*jobs.MockJobProgressRecorder), setupResources func(*resources.MockRepositoryResources, *resources.MockResourceClients)) error {
	resourceClients := resources.NewMockResourceClients(t)
	mockProgress := jobs.NewMockJobProgressRecorder(t)
	setupProgress(mockProgress)

	repoResources := resources.NewMockRepositoryResources(t)
	setupResources(repoResources, resourceClients)

	options := provisioningV0.ExportJobOptions{
		Path:      "grafana",
		Branch:    "feature/branch",
		Resources: resourceRefs,
	}

	err := ExportSpecificResources(context.Background(), repoConfig, options, resourceClients, repoResources, mockProgress)

	mockProgress.AssertExpectations(t)
	repoResources.AssertExpectations(t)
	resourceClients.AssertExpectations(t)

	return err
}

func TestExportSpecificResources_Success(t *testing.T) {
	repoConfig := createFolderSyncRepository()

	resourceRefs := []provisioningV0.ResourceRef{
		{
			Name:  "dashboard-1",
			Kind:  "Dashboard",
			Group: resources.DashboardResource.Group,
		},
		{
			Name:  "dashboard-2",
			Kind:  "Dashboard",
			Group: resources.DashboardResource.Group,
		},
	}

	folderItems := []unstructured.Unstructured{
		createFolderObject("team-a", "team-a-uid", ""),
	}

	dashboard1 := createDashboardObjectWithFolder("dashboard-1", "team-a-uid")
	dashboard2 := createDashboardObject("dashboard-2")

	setupProgress := func(progress *jobs.MockJobProgressRecorder) {
		progress.On("SetMessage", mock.Anything, "exporting specific resources").Return()
		progress.On("SetMessage", mock.Anything, "loading folder tree from API server").Return()
		progress.On("SetMessage", mock.Anything, mock.AnythingOfType("string")).Return().Maybe()
		progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
			return result.Name == "dashboard-1" && result.Action == repository.FileActionCreated
		})).Return()
		progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
			return result.Name == "dashboard-2" && result.Action == repository.FileActionCreated
		})).Return()
		progress.On("TooManyErrors").Return(nil).Times(2)
	}

	setupResources := func(repoResources *resources.MockRepositoryResources, resourceClients *resources.MockResourceClients) {
		// Setup folder client
		folderClient := &mockDynamicInterface{items: folderItems}
		resourceClients.On("Folder", mock.Anything).Return(folderClient, nil)

		// Setup dashboard clients - need separate clients for Get calls
		dashboard1Client := &mockDynamicInterface{
			items: []unstructured.Unstructured{dashboard1},
		}
		dashboard2Client := &mockDynamicInterface{
			items: []unstructured.Unstructured{dashboard2},
		}

		gvk := schema.GroupVersionKind{
			Group: resources.DashboardResource.Group,
			Kind:  "Dashboard",
		}
		// First call returns dashboard1Client, second returns dashboard2Client
		resourceClients.On("ForKind", mock.Anything, gvk).Return(dashboard1Client, resources.DashboardResource, nil).Once()
		resourceClients.On("ForKind", mock.Anything, gvk).Return(dashboard2Client, resources.DashboardResource, nil).Once()

		// Mock WriteResourceFileFromObject calls
		// dashboard-1 is in team-a folder
		repoResources.On("WriteResourceFileFromObject", mock.Anything,
			mock.MatchedBy(func(obj *unstructured.Unstructured) bool {
				return obj.GetName() == "dashboard-1"
			}),
			mock.MatchedBy(func(opts resources.WriteOptions) bool {
				return opts.Path == "grafana/team-a" && opts.Ref == "feature/branch"
			})).Return("grafana/team-a/dashboard-1.json", nil)

		// dashboard-2 has no folder
		repoResources.On("WriteResourceFileFromObject", mock.Anything,
			mock.MatchedBy(func(obj *unstructured.Unstructured) bool {
				return obj.GetName() == "dashboard-2"
			}),
			mock.MatchedBy(func(opts resources.WriteOptions) bool {
				return opts.Path == "grafana" && opts.Ref == "feature/branch"
			})).Return("grafana/dashboard-2.json", nil)
	}

	err := runExportSpecificResourcesTest(t, repoConfig, resourceRefs, folderItems, setupProgress, setupResources)
	require.NoError(t, err)
}

func TestExportSpecificResources_EmptyResources(t *testing.T) {
	repoConfig := createFolderSyncRepository()

	options := provisioningV0.ExportJobOptions{
		Path:      "grafana",
		Branch:    "feature/branch",
		Resources: []provisioningV0.ResourceRef{},
	}

	resourceClients := resources.NewMockResourceClients(t)
	repoResources := resources.NewMockRepositoryResources(t)
	mockProgress := jobs.NewMockJobProgressRecorder(t)

	err := ExportSpecificResources(context.Background(), repoConfig, options, resourceClients, repoResources, mockProgress)
	require.EqualError(t, err, "no resources specified for export")
}

func TestExportSpecificResources_RejectsInstanceSyncTarget(t *testing.T) {
	repoConfig := createInstanceSyncRepository()

	options := provisioningV0.ExportJobOptions{
		Path:   "grafana",
		Branch: "feature/branch",
		Resources: []provisioningV0.ResourceRef{
			{
				Name:  "dashboard-1",
				Kind:  "Dashboard",
				Group: resources.DashboardResource.Group,
			},
		},
	}

	resourceClients := resources.NewMockResourceClients(t)
	repoResources := resources.NewMockRepositoryResources(t)
	mockProgress := jobs.NewMockJobProgressRecorder(t)

	err := ExportSpecificResources(context.Background(), repoConfig, options, resourceClients, repoResources, mockProgress)
	require.EqualError(t, err, "specific resource export is only supported for folder sync targets, but repository has target type 'instance'")
}

func TestExportSpecificResources_RejectsFolders(t *testing.T) {
	repoConfig := createFolderSyncRepository()

	resourceRefs := []provisioningV0.ResourceRef{
		{
			Name:  "my-folder",
			Kind:  "Folder",
			Group: resources.FolderResource.Group,
		},
	}

	folderItems := []unstructured.Unstructured{}

	setupProgress := func(progress *jobs.MockJobProgressRecorder) {
		progress.On("SetMessage", mock.Anything, "exporting specific resources").Return()
		progress.On("SetMessage", mock.Anything, "loading folder tree from API server").Return()
		progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
			return result.Name == "my-folder" &&
				result.Action == repository.FileActionIgnored &&
				result.Error != nil &&
				result.Error.Error() == "folders are not supported for export"
		})).Return()
		progress.On("TooManyErrors").Return(nil)
	}

	setupResources := func(repoResources *resources.MockRepositoryResources, resourceClients *resources.MockResourceClients) {
		folderClient := &mockDynamicInterface{items: folderItems}
		resourceClients.On("Folder", mock.Anything).Return(folderClient, nil)
		// No ForKind or WriteResourceFileFromObject calls expected for folders
	}

	err := runExportSpecificResourcesTest(t, repoConfig, resourceRefs, folderItems, setupProgress, setupResources)
	require.NoError(t, err)
}

func TestExportSpecificResources_RejectsManagedResources(t *testing.T) {
	repoConfig := createFolderSyncRepository()

	resourceRefs := []provisioningV0.ResourceRef{
		{
			Name:  "managed-dashboard",
			Kind:  "Dashboard",
			Group: resources.DashboardResource.Group,
		},
	}

	folderItems := []unstructured.Unstructured{}

	dashboard := createDashboardObject("managed-dashboard")
	meta, _ := utils.MetaAccessor(&dashboard)
	meta.SetManagerProperties(utils.ManagerProperties{
		Kind:     utils.ManagerKindRepo,
		Identity: "some-repo",
	})

	setupProgress := func(progress *jobs.MockJobProgressRecorder) {
		progress.On("SetMessage", mock.Anything, "exporting specific resources").Return()
		progress.On("SetMessage", mock.Anything, "loading folder tree from API server").Return()
		progress.On("SetMessage", mock.Anything, mock.AnythingOfType("string")).Return().Maybe()
		progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
			return result.Name == "managed-dashboard" &&
				result.Action == repository.FileActionIgnored &&
				result.Error != nil &&
				result.Error.Error() == "resource dashboard.grafana.app/Dashboard/managed-dashboard is managed and cannot be exported"
		})).Return()
		progress.On("TooManyErrors").Return(nil)
	}

	setupResources := func(repoResources *resources.MockRepositoryResources, resourceClients *resources.MockResourceClients) {
		folderClient := &mockDynamicInterface{items: folderItems}
		resourceClients.On("Folder", mock.Anything).Return(folderClient, nil)

		dashboardClient := &mockDynamicInterface{
			items: []unstructured.Unstructured{dashboard},
		}
		gvk := schema.GroupVersionKind{
			Group: resources.DashboardResource.Group,
			Kind:  "Dashboard",
		}
		resourceClients.On("ForKind", mock.Anything, gvk).Return(dashboardClient, resources.DashboardResource, nil)
		// No WriteResourceFileFromObject call expected for managed resources
	}

	err := runExportSpecificResourcesTest(t, repoConfig, resourceRefs, folderItems, setupProgress, setupResources)
	require.NoError(t, err)
}

func TestExportSpecificResources_RejectsUnsupportedResources(t *testing.T) {
	repoConfig := createFolderSyncRepository()

	resourceRefs := []provisioningV0.ResourceRef{
		{
			Name:  "some-resource",
			Kind:  "Playlist",
			Group: "playlist.grafana.app",
		},
	}

	folderItems := []unstructured.Unstructured{}

	setupProgress := func(progress *jobs.MockJobProgressRecorder) {
		progress.On("SetMessage", mock.Anything, "exporting specific resources").Return()
		progress.On("SetMessage", mock.Anything, "loading folder tree from API server").Return()
		progress.On("SetMessage", mock.Anything, mock.AnythingOfType("string")).Return().Maybe()
		progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
			return result.Name == "some-resource" &&
				result.Action == repository.FileActionIgnored &&
				result.Error != nil &&
				result.Error.Error() == "resource type playlist.grafana.app/playlists is not supported for export"
		})).Return()
		progress.On("TooManyErrors").Return(nil)
	}

	setupResources := func(repoResources *resources.MockRepositoryResources, resourceClients *resources.MockResourceClients) {
		folderClient := &mockDynamicInterface{items: folderItems}
		resourceClients.On("Folder", mock.Anything).Return(folderClient, nil)

		// Mock ForKind to return a client (even though it's unsupported)
		unsupportedClient := &mockDynamicInterface{items: []unstructured.Unstructured{}}
		gvk := schema.GroupVersionKind{
			Group: "playlist.grafana.app",
			Kind:  "Playlist",
		}
		gvr := schema.GroupVersionResource{
			Group:    "playlist.grafana.app",
			Resource: "playlists",
		}
		resourceClients.On("ForKind", mock.Anything, gvk).Return(unsupportedClient, gvr, nil)
		// No WriteResourceFileFromObject call expected for unsupported resources
	}

	err := runExportSpecificResourcesTest(t, repoConfig, resourceRefs, folderItems, setupProgress, setupResources)
	require.NoError(t, err)
}

func TestExportSpecificResources_FolderPathResolution(t *testing.T) {
	repoConfig := createFolderSyncRepository()

	resourceRefs := []provisioningV0.ResourceRef{
		{
			Name:  "dashboard-in-nested-folder",
			Kind:  "Dashboard",
			Group: resources.DashboardResource.Group,
		},
	}

	// Create folder hierarchy: team-a -> subteam
	folderItems := []unstructured.Unstructured{
		createFolderObject("team-a", "team-a-uid", ""),
		createFolderObject("subteam", "subteam-uid", "team-a-uid"),
	}

	dashboard := createDashboardObjectWithFolder("dashboard-in-nested-folder", "subteam-uid")

	setupProgress := func(progress *jobs.MockJobProgressRecorder) {
		progress.On("SetMessage", mock.Anything, "exporting specific resources").Return()
		progress.On("SetMessage", mock.Anything, "loading folder tree from API server").Return()
		progress.On("SetMessage", mock.Anything, mock.AnythingOfType("string")).Return().Maybe()
		progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
			return result.Name == "dashboard-in-nested-folder" && result.Action == repository.FileActionCreated
		})).Return()
		progress.On("TooManyErrors").Return(nil)
	}

	setupResources := func(repoResources *resources.MockRepositoryResources, resourceClients *resources.MockResourceClients) {
		folderClient := &mockDynamicInterface{items: folderItems}
		resourceClients.On("Folder", mock.Anything).Return(folderClient, nil)

		dashboardClient := &mockDynamicInterface{
			items: []unstructured.Unstructured{dashboard},
		}
		gvk := schema.GroupVersionKind{
			Group: resources.DashboardResource.Group,
			Kind:  "Dashboard",
		}
		resourceClients.On("ForKind", mock.Anything, gvk).Return(dashboardClient, resources.DashboardResource, nil)

		// Verify that the path includes the nested folder structure: grafana/team-a/subteam
		repoResources.On("WriteResourceFileFromObject", mock.Anything,
			mock.MatchedBy(func(obj *unstructured.Unstructured) bool {
				return obj.GetName() == "dashboard-in-nested-folder"
			}),
			mock.MatchedBy(func(opts resources.WriteOptions) bool {
				return opts.Path == "grafana/team-a/subteam" && opts.Ref == "feature/branch"
			})).Return("grafana/team-a/subteam/dashboard-in-nested-folder.json", nil)
	}

	err := runExportSpecificResourcesTest(t, repoConfig, resourceRefs, folderItems, setupProgress, setupResources)
	require.NoError(t, err)
}

func TestExportSpecificResources_FolderClientError(t *testing.T) {
	repoConfig := createFolderSyncRepository()

	resourceRefs := []provisioningV0.ResourceRef{
		{
			Name:  "dashboard-1",
			Kind:  "Dashboard",
			Group: resources.DashboardResource.Group,
		},
	}

	setupProgress := func(progress *jobs.MockJobProgressRecorder) {
		progress.On("SetMessage", mock.Anything, "exporting specific resources").Return()
		progress.On("SetMessage", mock.Anything, "loading folder tree from API server").Return()
	}

	setupResources := func(repoResources *resources.MockRepositoryResources, resourceClients *resources.MockResourceClients) {
		resourceClients.On("Folder", mock.Anything).Return(nil, fmt.Errorf("folder client error"))
	}

	err := runExportSpecificResourcesTest(t, repoConfig, resourceRefs, nil, setupProgress, setupResources)
	require.EqualError(t, err, "get folder client: folder client error")
}

func TestExportSpecificResources_ResourceNotFound(t *testing.T) {
	repoConfig := createFolderSyncRepository()

	resourceRefs := []provisioningV0.ResourceRef{
		{
			Name:  "non-existent-dashboard",
			Kind:  "Dashboard",
			Group: resources.DashboardResource.Group,
		},
	}

	folderItems := []unstructured.Unstructured{}

	setupProgress := func(progress *jobs.MockJobProgressRecorder) {
		progress.On("SetMessage", mock.Anything, "exporting specific resources").Return()
		progress.On("SetMessage", mock.Anything, "loading folder tree from API server").Return()
		progress.On("SetMessage", mock.Anything, mock.AnythingOfType("string")).Return().Maybe()
		progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
			return result.Name == "non-existent-dashboard" &&
				result.Error != nil &&
				result.Error.Error() == "get resource dashboard.grafana.app/Dashboard/non-existent-dashboard: no items found"
		})).Return()
		progress.On("TooManyErrors").Return(nil)
	}

	setupResources := func(repoResources *resources.MockRepositoryResources, resourceClients *resources.MockResourceClients) {
		folderClient := &mockDynamicInterface{items: folderItems}
		resourceClients.On("Folder", mock.Anything).Return(folderClient, nil)

		// Empty client - resource not found
		dashboardClient := &mockDynamicInterface{
			items: []unstructured.Unstructured{},
		}
		gvk := schema.GroupVersionKind{
			Group: resources.DashboardResource.Group,
			Kind:  "Dashboard",
		}
		resourceClients.On("ForKind", mock.Anything, gvk).Return(dashboardClient, resources.DashboardResource, nil)
	}

	err := runExportSpecificResourcesTest(t, repoConfig, resourceRefs, folderItems, setupProgress, setupResources)
	require.NoError(t, err)
}

func TestExportSpecificResources_DashboardVersionConversion(t *testing.T) {
	repoConfig := createFolderSyncRepository()

	resourceRefs := []provisioningV0.ResourceRef{
		{
			Name:  "v2-dashboard",
			Kind:  "Dashboard",
			Group: resources.DashboardResource.Group,
		},
	}

	folderItems := []unstructured.Unstructured{}

	// Dashboard with storedVersion v2alpha1
	v1Dashboard := unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": resources.DashboardResource.GroupVersion().String(),
			"kind":       "Dashboard",
			"metadata": map[string]interface{}{
				"name": "v2-dashboard",
			},
			"status": map[string]interface{}{
				"conversion": map[string]interface{}{
					"failed":        true,
					"storedVersion": "v2alpha1",
				},
			},
		},
	}

	v2Dashboard := createV2DashboardObject("v2-dashboard", "v2alpha1")

	setupProgress := func(progress *jobs.MockJobProgressRecorder) {
		progress.On("SetMessage", mock.Anything, "exporting specific resources").Return()
		progress.On("SetMessage", mock.Anything, "loading folder tree from API server").Return()
		progress.On("SetMessage", mock.Anything, mock.AnythingOfType("string")).Return().Maybe()
		progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
			return result.Name == "v2-dashboard" && result.Action == repository.FileActionCreated
		})).Return()
		progress.On("TooManyErrors").Return(nil)
	}

	setupResources := func(repoResources *resources.MockRepositoryResources, resourceClients *resources.MockResourceClients) {
		folderClient := &mockDynamicInterface{items: folderItems}
		resourceClients.On("Folder", mock.Anything).Return(folderClient, nil)

		// v1 client returns dashboard with storedVersion
		v1Client := &mockDynamicInterface{
			items: []unstructured.Unstructured{v1Dashboard},
		}
		gvk := schema.GroupVersionKind{
			Group: resources.DashboardResource.Group,
			Kind:  "Dashboard",
		}
		resourceClients.On("ForKind", mock.Anything, gvk).Return(v1Client, resources.DashboardResource, nil)

		// v2alpha1 client for fetching original version
		v2Client := &mockDynamicInterface{
			items: []unstructured.Unstructured{v2Dashboard},
		}
		v2GVR := schema.GroupVersionResource{
			Group:    resources.DashboardResource.Group,
			Version:  "v2alpha1",
			Resource: resources.DashboardResource.Resource,
		}
		resourceClients.On("ForResource", mock.Anything, v2GVR).Return(v2Client, gvk, nil)

		// Verify WriteResourceFileFromObject is called with v2 dashboard
		repoResources.On("WriteResourceFileFromObject", mock.Anything,
			mock.MatchedBy(func(obj *unstructured.Unstructured) bool {
				return obj.GetName() == "v2-dashboard" &&
					obj.GetAPIVersion() == "dashboard.grafana.app/v2alpha1"
			}),
			mock.MatchedBy(func(opts resources.WriteOptions) bool {
				return opts.Path == "grafana" && opts.Ref == "feature/branch"
			})).Return("grafana/v2-dashboard.json", nil)
	}

	err := runExportSpecificResourcesTest(t, repoConfig, resourceRefs, folderItems, setupProgress, setupResources)
	require.NoError(t, err)
}

func TestExportSpecificResources_TooManyErrors(t *testing.T) {
	repoConfig := createFolderSyncRepository()

	resourceRefs := []provisioningV0.ResourceRef{
		{
			Name:  "dashboard-1",
			Kind:  "Dashboard",
			Group: resources.DashboardResource.Group,
		},
	}

	folderItems := []unstructured.Unstructured{}

	dashboard := createDashboardObject("dashboard-1")

	setupProgress := func(progress *jobs.MockJobProgressRecorder) {
		progress.On("SetMessage", mock.Anything, "exporting specific resources").Return()
		progress.On("SetMessage", mock.Anything, "loading folder tree from API server").Return()
		progress.On("SetMessage", mock.Anything, mock.AnythingOfType("string")).Return().Maybe()
		progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
			return result.Name == "dashboard-1" &&
				result.Action == repository.FileActionIgnored &&
				result.Error != nil
		})).Return()
		progress.On("TooManyErrors").Return(fmt.Errorf("too many errors"))
	}

	setupResources := func(repoResources *resources.MockRepositoryResources, resourceClients *resources.MockResourceClients) {
		folderClient := &mockDynamicInterface{items: folderItems}
		resourceClients.On("Folder", mock.Anything).Return(folderClient, nil)

		dashboardClient := &mockDynamicInterface{
			items: []unstructured.Unstructured{dashboard},
		}
		gvk := schema.GroupVersionKind{
			Group: resources.DashboardResource.Group,
			Kind:  "Dashboard",
		}
		resourceClients.On("ForKind", mock.Anything, gvk).Return(dashboardClient, resources.DashboardResource, nil)

		repoResources.On("WriteResourceFileFromObject", mock.Anything,
			mock.Anything,
			mock.Anything).Return("", fmt.Errorf("write error"))
	}

	err := runExportSpecificResourcesTest(t, repoConfig, resourceRefs, folderItems, setupProgress, setupResources)
	require.EqualError(t, err, "too many errors")
}
