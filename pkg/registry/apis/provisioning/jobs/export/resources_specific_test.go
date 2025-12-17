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

// createFolder creates a folder with the given Grafana UID as metadata.name and optional title
func createFolder(grafanaUID, k8sUID, title, parentUID string) unstructured.Unstructured {
	folder := unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": resources.FolderResource.GroupVersion().String(),
			"kind":       "Folder",
			"metadata": map[string]interface{}{
				"name": grafanaUID, // Grafana UID is stored as metadata.name
				"uid":  k8sUID,
			},
			"spec": map[string]interface{}{
				"title": title,
			},
		},
	}
	if parentUID != "" {
		meta, _ := utils.MetaAccessor(&folder)
		meta.SetFolder(parentUID)
	}
	return folder
}

// createDashboardWithFolder creates a dashboard in the specified folder
func createDashboardWithFolder(name, folderUID string) unstructured.Unstructured {
	dashboard := createDashboardObject(name)
	if folderUID != "" {
		meta, _ := utils.MetaAccessor(&dashboard)
		meta.SetFolder(folderUID)
	}
	return dashboard
}

func TestExportSpecificResources(t *testing.T) {
	tests := []struct {
		name          string
		setupMocks    func(t *testing.T) (resourceClients *resources.MockResourceClients, repoResources *resources.MockRepositoryResources, progress *jobs.MockJobProgressRecorder)
		options       provisioningV0.ExportJobOptions
		wantErr       string
		assertResults func(t *testing.T, resourceClients *resources.MockResourceClients, repoResources *resources.MockRepositoryResources, progress *jobs.MockJobProgressRecorder)
	}{
		{
			name: "success with folder paths",
			setupMocks: func(t *testing.T) (*resources.MockResourceClients, *resources.MockRepositoryResources, *jobs.MockJobProgressRecorder) {
				folder := createFolder("team-a-uid", "k8s-1", "team-a", "")
				dashboard1 := createDashboardWithFolder("dashboard-1", "team-a-uid")
				dashboard2 := createDashboardObject("dashboard-2")

				resourceClients := resources.NewMockResourceClients(t)
				folderClient := &mockDynamicInterface{items: []unstructured.Unstructured{folder}}
				resourceClients.On("Folder", mock.Anything).Return(folderClient, nil)

				gvk := schema.GroupVersionKind{Group: resources.DashboardResource.Group, Kind: "Dashboard"}
				resourceClients.On("ForKind", mock.Anything, gvk).Return(&mockDynamicInterface{items: []unstructured.Unstructured{dashboard1}}, resources.DashboardResource, nil).Once()
				resourceClients.On("ForKind", mock.Anything, gvk).Return(&mockDynamicInterface{items: []unstructured.Unstructured{dashboard2}}, resources.DashboardResource, nil).Once()

				repoResources := resources.NewMockRepositoryResources(t)
				repoResources.On("WriteResourceFileFromObject", mock.Anything,
					mock.MatchedBy(func(obj *unstructured.Unstructured) bool { return obj.GetName() == "dashboard-1" }),
					mock.MatchedBy(func(opts resources.WriteOptions) bool { return opts.Path == "grafana/team-a" })).
					Return("grafana/team-a/dashboard-1.json", nil)
				repoResources.On("WriteResourceFileFromObject", mock.Anything,
					mock.MatchedBy(func(obj *unstructured.Unstructured) bool { return obj.GetName() == "dashboard-2" }),
					mock.MatchedBy(func(opts resources.WriteOptions) bool { return opts.Path == "grafana" })).
					Return("grafana/dashboard-2.json", nil)

				progress := jobs.NewMockJobProgressRecorder(t)
				progress.On("SetMessage", mock.Anything, mock.Anything).Return().Maybe()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
					return r.Name == "dashboard-1" && r.Action == repository.FileActionCreated
				})).Return()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
					return r.Name == "dashboard-2" && r.Action == repository.FileActionCreated
				})).Return()
				progress.On("TooManyErrors").Return(nil).Times(2)

				return resourceClients, repoResources, progress
			},
			options: provisioningV0.ExportJobOptions{
				Path:   "grafana",
				Branch: "feature/branch",
				Resources: []provisioningV0.ResourceRef{
					{Name: "dashboard-1", Kind: "Dashboard", Group: resources.DashboardResource.Group},
					{Name: "dashboard-2", Kind: "Dashboard", Group: resources.DashboardResource.Group},
				},
			},
		},
		{
			name: "empty resources returns error",
			setupMocks: func(t *testing.T) (*resources.MockResourceClients, *resources.MockRepositoryResources, *jobs.MockJobProgressRecorder) {
				return nil, nil, nil
			},
			options: provisioningV0.ExportJobOptions{
				Resources: []provisioningV0.ResourceRef{},
			},
			wantErr: "no resources specified for export",
		},
		{
			name: "rejects folders",
			setupMocks: func(t *testing.T) (*resources.MockResourceClients, *resources.MockRepositoryResources, *jobs.MockJobProgressRecorder) {
				resourceClients := resources.NewMockResourceClients(t)
				resourceClients.On("Folder", mock.Anything).Return(&mockDynamicInterface{}, nil)

				progress := jobs.NewMockJobProgressRecorder(t)
				progress.On("SetMessage", mock.Anything, mock.Anything).Return()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
					return r.Name == "my-folder" && r.Error != nil && r.Error.Error() == "folders are not supported for export"
				})).Return()
				progress.On("TooManyErrors").Return(nil)

				return resourceClients, nil, progress
			},
			options: provisioningV0.ExportJobOptions{
				Resources: []provisioningV0.ResourceRef{{Name: "my-folder", Kind: "Folder", Group: resources.FolderResource.Group}},
			},
		},
		{
			name: "rejects managed resources",
			setupMocks: func(t *testing.T) (*resources.MockResourceClients, *resources.MockRepositoryResources, *jobs.MockJobProgressRecorder) {
				dashboard := createDashboardObject("managed-dashboard")
				meta, _ := utils.MetaAccessor(&dashboard)
				meta.SetManagerProperties(utils.ManagerProperties{Kind: utils.ManagerKindRepo, Identity: "some-repo"})

				resourceClients := resources.NewMockResourceClients(t)
				resourceClients.On("Folder", mock.Anything).Return(&mockDynamicInterface{}, nil)
				gvk := schema.GroupVersionKind{Group: resources.DashboardResource.Group, Kind: "Dashboard"}
				resourceClients.On("ForKind", mock.Anything, gvk).Return(&mockDynamicInterface{items: []unstructured.Unstructured{dashboard}}, resources.DashboardResource, nil)

				progress := jobs.NewMockJobProgressRecorder(t)
				progress.On("SetMessage", mock.Anything, mock.Anything).Return().Maybe()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
					return r.Name == "managed-dashboard" && r.Error != nil && r.Error.Error() == "resource dashboard.grafana.app/Dashboard/managed-dashboard is managed and cannot be exported"
				})).Return()
				progress.On("TooManyErrors").Return(nil)

				return resourceClients, nil, progress
			},
			options: provisioningV0.ExportJobOptions{
				Resources: []provisioningV0.ResourceRef{{Name: "managed-dashboard", Kind: "Dashboard", Group: resources.DashboardResource.Group}},
			},
		},
		{
			name: "rejects unsupported resources",
			setupMocks: func(t *testing.T) (*resources.MockResourceClients, *resources.MockRepositoryResources, *jobs.MockJobProgressRecorder) {
				resourceClients := resources.NewMockResourceClients(t)
				resourceClients.On("Folder", mock.Anything).Return(&mockDynamicInterface{}, nil)
				gvk := schema.GroupVersionKind{Group: "playlist.grafana.app", Kind: "Playlist"}
				gvr := schema.GroupVersionResource{Group: "playlist.grafana.app", Resource: "playlists"}
				resourceClients.On("ForKind", mock.Anything, gvk).Return(&mockDynamicInterface{}, gvr, nil)

				progress := jobs.NewMockJobProgressRecorder(t)
				progress.On("SetMessage", mock.Anything, mock.Anything).Return().Maybe()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
					return r.Name == "some-resource" && r.Error != nil && r.Error.Error() == "resource type playlist.grafana.app/playlists is not supported for export"
				})).Return()
				progress.On("TooManyErrors").Return(nil)

				return resourceClients, nil, progress
			},
			options: provisioningV0.ExportJobOptions{
				Resources: []provisioningV0.ResourceRef{{Name: "some-resource", Kind: "Playlist", Group: "playlist.grafana.app"}},
			},
		},
		{
			name: "resolves nested folder paths",
			setupMocks: func(t *testing.T) (*resources.MockResourceClients, *resources.MockRepositoryResources, *jobs.MockJobProgressRecorder) {
				parentFolder := createFolder("team-a-uid", "k8s-1", "team-a", "")
				childFolder := createFolder("subteam-uid", "k8s-2", "subteam", "team-a-uid")
				dashboard := createDashboardWithFolder("dashboard-in-nested-folder", "subteam-uid")

				resourceClients := resources.NewMockResourceClients(t)
				resourceClients.On("Folder", mock.Anything).Return(&mockDynamicInterface{items: []unstructured.Unstructured{parentFolder, childFolder}}, nil)
				gvk := schema.GroupVersionKind{Group: resources.DashboardResource.Group, Kind: "Dashboard"}
				resourceClients.On("ForKind", mock.Anything, gvk).Return(&mockDynamicInterface{items: []unstructured.Unstructured{dashboard}}, resources.DashboardResource, nil)

				repoResources := resources.NewMockRepositoryResources(t)
				repoResources.On("WriteResourceFileFromObject", mock.Anything,
					mock.MatchedBy(func(obj *unstructured.Unstructured) bool { return obj.GetName() == "dashboard-in-nested-folder" }),
					mock.MatchedBy(func(opts resources.WriteOptions) bool { return opts.Path == "grafana/team-a/subteam" })).
					Return("grafana/team-a/subteam/dashboard-in-nested-folder.json", nil)

				progress := jobs.NewMockJobProgressRecorder(t)
				progress.On("SetMessage", mock.Anything, mock.Anything).Return().Maybe()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
					return r.Name == "dashboard-in-nested-folder" && r.Action == repository.FileActionCreated
				})).Return()
				progress.On("TooManyErrors").Return(nil)

				return resourceClients, repoResources, progress
			},
			options: provisioningV0.ExportJobOptions{
				Path:      "grafana",
				Branch:    "feature/branch",
				Resources: []provisioningV0.ResourceRef{{Name: "dashboard-in-nested-folder", Kind: "Dashboard", Group: resources.DashboardResource.Group}},
			},
		},
		{
			name: "folder client error",
			setupMocks: func(t *testing.T) (*resources.MockResourceClients, *resources.MockRepositoryResources, *jobs.MockJobProgressRecorder) {
				resourceClients := resources.NewMockResourceClients(t)
				resourceClients.On("Folder", mock.Anything).Return(nil, fmt.Errorf("folder client error"))

				progress := jobs.NewMockJobProgressRecorder(t)
				progress.On("SetMessage", mock.Anything, mock.Anything).Return()

				return resourceClients, nil, progress
			},
			options: provisioningV0.ExportJobOptions{
				Resources: []provisioningV0.ResourceRef{{Name: "dashboard-1", Kind: "Dashboard", Group: resources.DashboardResource.Group}},
			},
			wantErr: "get folder client: folder client error",
		},
		{
			name: "resource not found",
			setupMocks: func(t *testing.T) (*resources.MockResourceClients, *resources.MockRepositoryResources, *jobs.MockJobProgressRecorder) {
				resourceClients := resources.NewMockResourceClients(t)
				resourceClients.On("Folder", mock.Anything).Return(&mockDynamicInterface{}, nil)
				gvk := schema.GroupVersionKind{Group: resources.DashboardResource.Group, Kind: "Dashboard"}
				resourceClients.On("ForKind", mock.Anything, gvk).Return(&mockDynamicInterface{}, resources.DashboardResource, nil)

				progress := jobs.NewMockJobProgressRecorder(t)
				progress.On("SetMessage", mock.Anything, mock.Anything).Return().Maybe()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
					return r.Name == "non-existent-dashboard" && r.Error != nil && r.Error.Error() == "get resource dashboard.grafana.app/Dashboard/non-existent-dashboard: no items found"
				})).Return()
				progress.On("TooManyErrors").Return(nil)

				return resourceClients, nil, progress
			},
			options: provisioningV0.ExportJobOptions{
				Resources: []provisioningV0.ResourceRef{{Name: "non-existent-dashboard", Kind: "Dashboard", Group: resources.DashboardResource.Group}},
			},
		},
		{
			name: "dashboard version conversion",
			setupMocks: func(t *testing.T) (*resources.MockResourceClients, *resources.MockRepositoryResources, *jobs.MockJobProgressRecorder) {
				v1Dashboard := unstructured.Unstructured{
					Object: map[string]interface{}{
						"apiVersion": resources.DashboardResource.GroupVersion().String(),
						"kind":       "Dashboard",
						"metadata":   map[string]interface{}{"name": "v2-dashboard"},
						"status": map[string]interface{}{
							"conversion": map[string]interface{}{"failed": true, "storedVersion": "v2alpha1"},
						},
					},
				}
				v2Dashboard := createV2DashboardObject("v2-dashboard", "v2alpha1")

				resourceClients := resources.NewMockResourceClients(t)
				resourceClients.On("Folder", mock.Anything).Return(&mockDynamicInterface{}, nil)
				gvk := schema.GroupVersionKind{Group: resources.DashboardResource.Group, Kind: "Dashboard"}
				resourceClients.On("ForKind", mock.Anything, gvk).Return(&mockDynamicInterface{items: []unstructured.Unstructured{v1Dashboard}}, resources.DashboardResource, nil)
				v2GVR := schema.GroupVersionResource{Group: resources.DashboardResource.Group, Version: "v2alpha1", Resource: resources.DashboardResource.Resource}
				resourceClients.On("ForResource", mock.Anything, v2GVR).Return(&mockDynamicInterface{items: []unstructured.Unstructured{v2Dashboard}}, gvk, nil)

				repoResources := resources.NewMockRepositoryResources(t)
				repoResources.On("WriteResourceFileFromObject", mock.Anything,
					mock.MatchedBy(func(obj *unstructured.Unstructured) bool {
						return obj.GetName() == "v2-dashboard" && obj.GetAPIVersion() == "dashboard.grafana.app/v2alpha1"
					}),
					mock.Anything).Return("grafana/v2-dashboard.json", nil)

				progress := jobs.NewMockJobProgressRecorder(t)
				progress.On("SetMessage", mock.Anything, mock.Anything).Return().Maybe()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
					return r.Name == "v2-dashboard" && r.Action == repository.FileActionCreated
				})).Return()
				progress.On("TooManyErrors").Return(nil)

				return resourceClients, repoResources, progress
			},
			options: provisioningV0.ExportJobOptions{
				Resources: []provisioningV0.ResourceRef{{Name: "v2-dashboard", Kind: "Dashboard", Group: resources.DashboardResource.Group}},
			},
		},
		{
			name: "too many errors",
			setupMocks: func(t *testing.T) (*resources.MockResourceClients, *resources.MockRepositoryResources, *jobs.MockJobProgressRecorder) {
				dashboard := createDashboardObject("dashboard-1")

				resourceClients := resources.NewMockResourceClients(t)
				resourceClients.On("Folder", mock.Anything).Return(&mockDynamicInterface{}, nil)
				gvk := schema.GroupVersionKind{Group: resources.DashboardResource.Group, Kind: "Dashboard"}
				resourceClients.On("ForKind", mock.Anything, gvk).Return(&mockDynamicInterface{items: []unstructured.Unstructured{dashboard}}, resources.DashboardResource, nil)

				repoResources := resources.NewMockRepositoryResources(t)
				repoResources.On("WriteResourceFileFromObject", mock.Anything, mock.Anything, mock.Anything).Return("", fmt.Errorf("write error"))

				progress := jobs.NewMockJobProgressRecorder(t)
				progress.On("SetMessage", mock.Anything, mock.Anything).Return().Maybe()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
					return r.Name == "dashboard-1" && r.Action == repository.FileActionIgnored && r.Error != nil
				})).Return()
				progress.On("TooManyErrors").Return(fmt.Errorf("too many errors"))

				return resourceClients, repoResources, progress
			},
			options: provisioningV0.ExportJobOptions{
				Resources: []provisioningV0.ResourceRef{{Name: "dashboard-1", Kind: "Dashboard", Group: resources.DashboardResource.Group}},
			},
			wantErr: "too many errors",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resourceClients, repoResources, progress := tt.setupMocks(t)

			err := ExportSpecificResources(context.Background(), "test-repo", tt.options, resourceClients, repoResources, progress)

			if tt.wantErr != "" {
				require.EqualError(t, err, tt.wantErr)
			} else {
				require.NoError(t, err)
			}

			if tt.assertResults != nil {
				tt.assertResults(t, resourceClients, repoResources, progress)
			}
		})
	}
}
