package export

import (
	"context"
	"fmt"
	"testing"

	mock "github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	provisioningV0 "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

func TestExportResources_Dashboards(t *testing.T) {
	tests := []struct {
		name           string
		mockItems      []unstructured.Unstructured
		expectedError  string
		setupProgress  func(progress *jobs.MockJobProgressRecorder)
		setupResources func(repoResources *resources.MockRepositoryResources, resourceClients *resources.MockResourceClients, mockClient *mockDynamicInterface, gvk schema.GroupVersionKind)
	}{
		{
			name: "successful dashboard export",
			mockItems: []unstructured.Unstructured{
				{
					Object: map[string]interface{}{
						"apiVersion": resources.DashboardResource.GroupVersion().String(),
						"kind":       "Dashboard",
						"metadata": map[string]interface{}{
							"name": "dashboard-1",
						},
					},
				},
				{
					Object: map[string]interface{}{
						"apiVersion": resources.DashboardResource.GroupVersion().String(),
						"kind":       "Dashboard",
						"metadata": map[string]interface{}{
							"name": "dashboard-2",
						},
					},
				},
			},
			expectedError: "",
			setupProgress: func(progress *jobs.MockJobProgressRecorder) {
				progress.On("SetMessage", mock.Anything, "start resource export").Return()
				progress.On("SetMessage", mock.Anything, "export dashboards").Return()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Name == "dashboard-1" && result.Action == repository.FileActionCreated
				})).Return()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Name == "dashboard-2" && result.Action == repository.FileActionCreated
				})).Return()
				progress.On("TooManyErrors").Return(nil)
				progress.On("TooManyErrors").Return(nil)
			},
			setupResources: func(repoResources *resources.MockRepositoryResources, resourceClients *resources.MockResourceClients, mockClient *mockDynamicInterface, gvk schema.GroupVersionKind) {
				resourceClients.On("ForResource", resources.DashboardResource).Return(mockClient, gvk, nil)
				options := resources.WriteOptions{
					Path: "grafana",
					Ref:  "feature/branch",
				}

				repoResources.On("WriteResourceFileFromObject", mock.Anything, mock.MatchedBy(func(obj *unstructured.Unstructured) bool {
					return obj.GetName() == "dashboard-1"
				}), options).Return("dashboard-1.json", nil)

				repoResources.On("WriteResourceFileFromObject", mock.Anything, mock.MatchedBy(func(obj *unstructured.Unstructured) bool {
					return obj.GetName() == "dashboard-2"
				}), options).Return("dashboard-2.json", nil)
			},
		},
		{
			name:          "client error",
			mockItems:     nil,
			expectedError: "get client for dashboards: didn't work",
			setupProgress: func(progress *jobs.MockJobProgressRecorder) {
				progress.On("SetMessage", mock.Anything, "start resource export").Return()
				progress.On("SetMessage", mock.Anything, "export dashboards").Return()
			},
			setupResources: func(repoResources *resources.MockRepositoryResources, resourceClients *resources.MockResourceClients, mockClient *mockDynamicInterface, gvk schema.GroupVersionKind) {
				resourceClients.On("ForResource", resources.DashboardResource).Return(mockClient, gvk, fmt.Errorf("didn't work"))
			},
		},
		{
			name: "dashboard export with errors",
			mockItems: []unstructured.Unstructured{
				{
					Object: map[string]interface{}{
						"apiVersion": resources.DashboardResource.GroupVersion().String(),
						"kind":       "Dashboard",
						"metadata": map[string]interface{}{
							"name": "dashboard-1",
						},
					},
				},
				{
					Object: map[string]interface{}{
						"apiVersion": resources.DashboardResource.GroupVersion().String(),
						"kind":       "Dashboard",
						"metadata": map[string]interface{}{
							"name": "dashboard-2",
						},
					},
				},
			},
			expectedError: "",
			setupProgress: func(progress *jobs.MockJobProgressRecorder) {
				progress.On("SetMessage", mock.Anything, "start resource export").Return()
				progress.On("SetMessage", mock.Anything, "export dashboards").Return()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Name == "dashboard-1" && result.Action == repository.FileActionIgnored && result.Error != nil && result.Error.Error() == "failed to export dashboard"
				})).Return()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Name == "dashboard-2" && result.Action == repository.FileActionCreated
				})).Return()
				progress.On("TooManyErrors").Return(nil)
				progress.On("TooManyErrors").Return(nil)
			},
			setupResources: func(repoResources *resources.MockRepositoryResources, resourceClients *resources.MockResourceClients, mockClient *mockDynamicInterface, gvk schema.GroupVersionKind) {
				resourceClients.On("ForResource", resources.DashboardResource).Return(mockClient, gvk, nil)
				options := resources.WriteOptions{
					Path: "grafana",
					Ref:  "feature/branch",
				}

				repoResources.On("WriteResourceFileFromObject", mock.Anything, mock.MatchedBy(func(obj *unstructured.Unstructured) bool {
					return obj.GetName() == "dashboard-1"
				}), options).Return("", fmt.Errorf("failed to export dashboard"))

				repoResources.On("WriteResourceFileFromObject", mock.Anything, mock.MatchedBy(func(obj *unstructured.Unstructured) bool {
					return obj.GetName() == "dashboard-2"
				}), options).Return("dashboard-2.json", nil)
			},
		},
		{
			name: "dashboard export too many errors",
			mockItems: []unstructured.Unstructured{
				{
					Object: map[string]interface{}{
						"apiVersion": resources.DashboardResource.GroupVersion().String(),
						"kind":       "Dashboard",
						"metadata": map[string]interface{}{
							"name": "dashboard-1",
						},
					},
				},
			},
			expectedError: "export dashboards: too many errors encountered",
			setupProgress: func(progress *jobs.MockJobProgressRecorder) {
				progress.On("SetMessage", mock.Anything, "start resource export").Return()
				progress.On("SetMessage", mock.Anything, "export dashboards").Return()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Name == "dashboard-1" && result.Action == repository.FileActionIgnored && result.Error != nil && result.Error.Error() == "failed to export dashboard"
				})).Return()
				progress.On("TooManyErrors").Return(fmt.Errorf("too many errors encountered"))
			},
			setupResources: func(repoResources *resources.MockRepositoryResources, resourceClients *resources.MockResourceClients, mockClient *mockDynamicInterface, gvk schema.GroupVersionKind) {
				resourceClients.On("ForResource", resources.DashboardResource).Return(mockClient, gvk, nil)
				options := resources.WriteOptions{
					Path: "grafana",
					Ref:  "feature/branch",
				}

				repoResources.On("WriteResourceFileFromObject", mock.Anything, mock.MatchedBy(func(obj *unstructured.Unstructured) bool {
					return obj.GetName() == "dashboard-1"
				}), options).Return("", fmt.Errorf("failed to export dashboard"))
			},
		},
		{
			name: "ignores existing dashboards",
			mockItems: []unstructured.Unstructured{
				{
					Object: map[string]interface{}{
						"apiVersion": resources.DashboardResource.GroupVersion().String(),
						"kind":       "Dashboard",
						"metadata": map[string]interface{}{
							"name": "existing-dashboard",
						},
					},
				},
			},
			expectedError: "",
			setupProgress: func(progress *jobs.MockJobProgressRecorder) {
				progress.On("SetMessage", mock.Anything, "start resource export").Return()
				progress.On("SetMessage", mock.Anything, "export dashboards").Return()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Name == "existing-dashboard" && result.Action == repository.FileActionIgnored
				})).Return()
				progress.On("TooManyErrors").Return(nil)
			},
			setupResources: func(repoResources *resources.MockRepositoryResources, resourceClients *resources.MockResourceClients, mockClient *mockDynamicInterface, gvk schema.GroupVersionKind) {
				resourceClients.On("ForResource", resources.DashboardResource).Return(mockClient, gvk, nil)
				options := resources.WriteOptions{
					Path: "grafana",
					Ref:  "feature/branch",
				}

				repoResources.On("WriteResourceFileFromObject", mock.Anything, mock.MatchedBy(func(obj *unstructured.Unstructured) bool {
					return obj.GetName() == "existing-dashboard"
				}), options).Return("", resources.ErrAlreadyInRepository)
			},
		},
		{
			name: "uses saved dashboard version",
			mockItems: []unstructured.Unstructured{
				{
					Object: map[string]interface{}{
						"apiVersion": resources.DashboardResource.GroupVersion().String(),
						"kind":       "Dashboard",
						"metadata": map[string]interface{}{
							"name": "existing-dashboard",
						},
						"spec": map[string]interface{}{
							"hello": "world",
						},
						"status": map[string]interface{}{
							"conversion": map[string]interface{}{
								"failed":        true,
								"storedVersion": "v0xyz",
							},
						},
					},
				},
			},
			expectedError: "",
			setupProgress: func(progress *jobs.MockJobProgressRecorder) {
				progress.On("SetMessage", mock.Anything, "start resource export").Return()
				progress.On("SetMessage", mock.Anything, "export dashboards").Return()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Name == "existing-dashboard" && result.Action == repository.FileActionIgnored
				})).Return()
				progress.On("TooManyErrors").Return(nil)
			},
			setupResources: func(repoResources *resources.MockRepositoryResources, resourceClients *resources.MockResourceClients, mockClient *mockDynamicInterface, gvk schema.GroupVersionKind) {
				resourceClients.On("ForResource", resources.DashboardResource).Return(mockClient, gvk, nil)
				options := resources.WriteOptions{
					Path: "grafana",
					Ref:  "feature/branch",
				}

				repoResources.On("WriteResourceFileFromObject", mock.Anything, mock.MatchedBy(func(obj *unstructured.Unstructured) bool {
					// Verify that the object has the expected status.conversion.storedVersion field
					status, exists, err := unstructured.NestedMap(obj.Object, "status")
					if !exists || err != nil {
						return false
					}

					conversion, exists, err := unstructured.NestedMap(status, "conversion")
					if !exists || err != nil {
						return false
					}

					storedVersion, exists, err := unstructured.NestedString(conversion, "storedVersion")
					if !exists || err != nil {
						return false
					}

					if storedVersion != "v0xyz" {
						return false
					}

					return obj.GetName() == "existing-dashboard"
				}), options).Return("", fmt.Errorf("XXX"))
			},
		},
		{
			name: "dashboard with failed conversion but no stored version",
			mockItems: []unstructured.Unstructured{
				{
					Object: map[string]interface{}{
						"apiVersion": resources.DashboardResource.GroupVersion().String(),
						"kind":       "Dashboard",
						"metadata": map[string]interface{}{
							"name": "dashboard-no-stored-version",
						},
						"status": map[string]interface{}{
							"conversion": map[string]interface{}{
								"failed": true,
								// No storedVersion field
							},
						},
					},
				},
			},
			expectedError: "",
			setupProgress: func(progress *jobs.MockJobProgressRecorder) {
				progress.On("SetMessage", mock.Anything, "start resource export").Return()
				progress.On("SetMessage", mock.Anything, "export dashboards").Return()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Name == "dashboard-no-stored-version" &&
						result.Action == repository.FileActionIgnored &&
						result.Error != nil
				})).Return()
				progress.On("TooManyErrors").Return(nil)
			},
			setupResources: func(repoResources *resources.MockRepositoryResources, resourceClients *resources.MockResourceClients, mockClient *mockDynamicInterface, gvk schema.GroupVersionKind) {
				resourceClients.On("ForResource", resources.DashboardResource).Return(mockClient, gvk, nil)
				// The value is not saved
			},
		},
		{
			name: "handles v2 dashboard version",
			mockItems: []unstructured.Unstructured{
				{
					Object: map[string]interface{}{
						"apiVersion": resources.DashboardResource.GroupVersion().String(),
						"kind":       "Dashboard",
						"metadata": map[string]interface{}{
							"name": "v2-dashboard",
						},
						"status": map[string]interface{}{
							"conversion": map[string]interface{}{
								"failed":        true,
								"storedVersion": "v2",
							},
						},
					},
				},
			},
			expectedError: "",
			setupProgress: func(progress *jobs.MockJobProgressRecorder) {
				progress.On("SetMessage", mock.Anything, "start resource export").Return()
				progress.On("SetMessage", mock.Anything, "export dashboards").Return()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Name == "v2-dashboard" && result.Action == repository.FileActionCreated
				})).Return()
				progress.On("TooManyErrors").Return(nil)
			},
			setupResources: func(repoResources *resources.MockRepositoryResources, resourceClients *resources.MockResourceClients, mockClient *mockDynamicInterface, gvk schema.GroupVersionKind) {
				// Setup v1 client
				resourceClients.On("ForResource", resources.DashboardResource).Return(mockClient, gvk, nil)

				// Setup v2 client

				// Mock v2 client Get call
				v2Dashboard := &unstructured.Unstructured{
					Object: map[string]interface{}{
						"apiVersion": "dashboard.grafana.app/v2alpha1",
						"kind":       "Dashboard",
						"metadata": map[string]interface{}{
							"name": "v2-dashboard",
						},
						"spec": map[string]interface{}{
							"version": 2,
							"title":   "V2 Dashboard",
						},
					},
				}
				v2Client := &mockDynamicInterface{items: []unstructured.Unstructured{*v2Dashboard}}
				resourceClients.On("ForResource", resources.DashboardResourceV2).Return(v2Client, gvk, nil)

				options := resources.WriteOptions{
					Path: "grafana",
					Ref:  "feature/branch",
				}
				repoResources.On("WriteResourceFileFromObject", mock.Anything, v2Dashboard, options).Return("v2-dashboard.json", nil)
			},
		},
		{
			name: "handles v2 client creation error",
			mockItems: []unstructured.Unstructured{
				{
					Object: map[string]interface{}{
						"apiVersion": resources.DashboardResource.GroupVersion().String(),
						"kind":       "Dashboard",
						"metadata": map[string]interface{}{
							"name": "v2-dashboard-error",
						},
						"status": map[string]interface{}{
							"conversion": map[string]interface{}{
								"failed":        true,
								"storedVersion": "v2",
							},
						},
					},
				},
			},
			setupProgress: func(progress *jobs.MockJobProgressRecorder) {
				progress.On("SetMessage", mock.Anything, "start resource export").Return()
				progress.On("SetMessage", mock.Anything, "export dashboards").Return()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					if result.Name != "v2-dashboard-error" {
						return false
					}
					if result.Action != repository.FileActionIgnored {
						return false
					}
					if result.Error == nil {
						return false
					}

					if result.Error.Error() != "v2 client error" {
						return false
					}

					return true
				})).Return()
				progress.On("TooManyErrors").Return(nil)
			},
			setupResources: func(repoResources *resources.MockRepositoryResources, resourceClients *resources.MockResourceClients, mockClient *mockDynamicInterface, gvk schema.GroupVersionKind) {
				resourceClients.On("ForResource", resources.DashboardResource).Return(mockClient, gvk, nil)
				resourceClients.On("ForResource", resources.DashboardResourceV2).Return(nil, gvk, fmt.Errorf("v2 client error"))
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := &mockDynamicInterface{
				items: tt.mockItems,
			}

			resourceClients := resources.NewMockResourceClients(t)
			mockProgress := jobs.NewMockJobProgressRecorder(t)
			tt.setupProgress(mockProgress)

			repoResources := resources.NewMockRepositoryResources(t)
			tt.setupResources(repoResources, resourceClients, mockClient, schema.GroupVersionKind{
				Group:   resources.DashboardResource.Group,
				Version: resources.DashboardResource.Version,
				Kind:    "DashboardList",
			})

			options := provisioningV0.ExportJobOptions{
				Path:   "grafana",
				Branch: "feature/branch",
			}

			err := ExportResources(context.Background(), options, resourceClients, repoResources, mockProgress)
			if tt.expectedError != "" {
				require.EqualError(t, err, tt.expectedError)
			} else {
				require.NoError(t, err)
			}

			mockProgress.AssertExpectations(t)
			repoResources.AssertExpectations(t)
			resourceClients.AssertExpectations(t)
		})
	}
}
