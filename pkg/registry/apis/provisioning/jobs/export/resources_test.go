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
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

// Helper function to create dashboard objects
func createDashboardObject(name string) unstructured.Unstructured {
	return unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": resources.DashboardResource.GroupVersion().String(),
			"kind":       "Dashboard",
			"metadata": map[string]interface{}{
				"name": name,
			},
		},
	}
}

// Helper function to create v2 dashboard objects
func createV2DashboardObject(name, version string) unstructured.Unstructured {
	return unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": fmt.Sprintf("dashboard.grafana.app/%s", version),
			"kind":       "Dashboard",
			"metadata": map[string]interface{}{
				"name": name,
			},
			"spec": map[string]interface{}{
				"version": 2,
				"title":   "V2 Dashboard",
			},
		},
	}
}

// Helper function to run export test
func runExportTest(t *testing.T, mockItems []unstructured.Unstructured, setupProgress func(*jobs.MockJobProgressRecorder), setupResources func(*resources.MockRepositoryResources, *resources.MockResourceClients, *mockDynamicInterface, schema.GroupVersionKind)) error {
	mockClient := &mockDynamicInterface{
		items: mockItems,
	}

	resourceClients := resources.NewMockResourceClients(t)
	mockProgress := jobs.NewMockJobProgressRecorder(t)
	setupProgress(mockProgress)

	repoResources := resources.NewMockRepositoryResources(t)
	setupResources(repoResources, resourceClients, mockClient, schema.GroupVersionKind{
		Group:   resources.DashboardResource.Group,
		Version: resources.DashboardResource.Version,
		Kind:    "DashboardList",
	})

	options := provisioningV0.ExportJobOptions{
		Path:   "grafana",
		Branch: "feature/branch",
	}

	err := ExportResources(context.Background(), options, resourceClients, repoResources, mockProgress)

	mockProgress.AssertExpectations(t)
	repoResources.AssertExpectations(t)
	resourceClients.AssertExpectations(t)

	return err
}

func TestExportResources_Dashboards_Success(t *testing.T) {
	mockItems := []unstructured.Unstructured{
		createDashboardObject("dashboard-1"),
		createDashboardObject("dashboard-2"),
	}

	setupProgress := func(progress *jobs.MockJobProgressRecorder) {
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
	}

	setupResources := func(repoResources *resources.MockRepositoryResources, resourceClients *resources.MockResourceClients, mockClient *mockDynamicInterface, gvk schema.GroupVersionKind) {
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
	}

	err := runExportTest(t, mockItems, setupProgress, setupResources)
	require.NoError(t, err)
}

func TestExportResources_Dashboards_ClientError(t *testing.T) {
	setupProgress := func(progress *jobs.MockJobProgressRecorder) {
		progress.On("SetMessage", mock.Anything, "start resource export").Return()
		progress.On("SetMessage", mock.Anything, "export dashboards").Return()
	}

	setupResources := func(repoResources *resources.MockRepositoryResources, resourceClients *resources.MockResourceClients, mockClient *mockDynamicInterface, gvk schema.GroupVersionKind) {
		resourceClients.On("ForResource", resources.DashboardResource).Return(mockClient, gvk, fmt.Errorf("didn't work"))
	}

	err := runExportTest(t, nil, setupProgress, setupResources)
	require.EqualError(t, err, "get client for dashboards: didn't work")
}

func TestExportResources_Dashboards_WithErrors(t *testing.T) {
	mockItems := []unstructured.Unstructured{
		createDashboardObject("dashboard-1"),
		createDashboardObject("dashboard-2"),
	}

	setupProgress := func(progress *jobs.MockJobProgressRecorder) {
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
	}

	setupResources := func(repoResources *resources.MockRepositoryResources, resourceClients *resources.MockResourceClients, mockClient *mockDynamicInterface, gvk schema.GroupVersionKind) {
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
	}

	err := runExportTest(t, mockItems, setupProgress, setupResources)
	require.NoError(t, err)
}

func TestExportResources_Dashboards_TooManyErrors(t *testing.T) {
	mockItems := []unstructured.Unstructured{
		createDashboardObject("dashboard-1"),
	}

	setupProgress := func(progress *jobs.MockJobProgressRecorder) {
		progress.On("SetMessage", mock.Anything, "start resource export").Return()
		progress.On("SetMessage", mock.Anything, "export dashboards").Return()
		progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
			return result.Name == "dashboard-1" && result.Action == repository.FileActionIgnored && result.Error != nil && result.Error.Error() == "failed to export dashboard"
		})).Return()
		progress.On("TooManyErrors").Return(fmt.Errorf("too many errors encountered"))
	}

	setupResources := func(repoResources *resources.MockRepositoryResources, resourceClients *resources.MockResourceClients, mockClient *mockDynamicInterface, gvk schema.GroupVersionKind) {
		resourceClients.On("ForResource", resources.DashboardResource).Return(mockClient, gvk, nil)
		options := resources.WriteOptions{
			Path: "grafana",
			Ref:  "feature/branch",
		}

		repoResources.On("WriteResourceFileFromObject", mock.Anything, mock.MatchedBy(func(obj *unstructured.Unstructured) bool {
			return obj.GetName() == "dashboard-1"
		}), options).Return("", fmt.Errorf("failed to export dashboard"))
	}

	err := runExportTest(t, mockItems, setupProgress, setupResources)
	require.EqualError(t, err, "export dashboards: too many errors encountered")
}

func TestExportResources_Dashboards_IgnoresExisting(t *testing.T) {
	mockItems := []unstructured.Unstructured{
		createDashboardObject("existing-dashboard"),
	}

	setupProgress := func(progress *jobs.MockJobProgressRecorder) {
		progress.On("SetMessage", mock.Anything, "start resource export").Return()
		progress.On("SetMessage", mock.Anything, "export dashboards").Return()
		progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
			return result.Name == "existing-dashboard" && result.Action == repository.FileActionIgnored
		})).Return()
		progress.On("TooManyErrors").Return(nil)
	}

	setupResources := func(repoResources *resources.MockRepositoryResources, resourceClients *resources.MockResourceClients, mockClient *mockDynamicInterface, gvk schema.GroupVersionKind) {
		resourceClients.On("ForResource", resources.DashboardResource).Return(mockClient, gvk, nil)
		options := resources.WriteOptions{
			Path: "grafana",
			Ref:  "feature/branch",
		}

		repoResources.On("WriteResourceFileFromObject", mock.Anything, mock.MatchedBy(func(obj *unstructured.Unstructured) bool {
			return obj.GetName() == "existing-dashboard"
		}), options).Return("", resources.ErrAlreadyInRepository)
	}

	err := runExportTest(t, mockItems, setupProgress, setupResources)
	require.NoError(t, err)
}

func TestExportResources_Dashboards_SavedVersion(t *testing.T) {
	mockItems := []unstructured.Unstructured{
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
	}

	setupProgress := func(progress *jobs.MockJobProgressRecorder) {
		progress.On("SetMessage", mock.Anything, "start resource export").Return()
		progress.On("SetMessage", mock.Anything, "export dashboards").Return()
		progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
			return result.Name == "existing-dashboard" && result.Action == repository.FileActionIgnored
		})).Return()
		progress.On("TooManyErrors").Return(nil)
	}

	setupResources := func(repoResources *resources.MockRepositoryResources, resourceClients *resources.MockResourceClients, mockClient *mockDynamicInterface, gvk schema.GroupVersionKind) {
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
	}

	err := runExportTest(t, mockItems, setupProgress, setupResources)
	require.NoError(t, err)
}

func TestExportResources_Dashboards_FailedConversionNoStoredVersion(t *testing.T) {
	mockItems := []unstructured.Unstructured{
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
	}

	setupProgress := func(progress *jobs.MockJobProgressRecorder) {
		progress.On("SetMessage", mock.Anything, "start resource export").Return()
		progress.On("SetMessage", mock.Anything, "export dashboards").Return()
		progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
			return result.Name == "dashboard-no-stored-version" &&
				result.Action == repository.FileActionIgnored &&
				result.Error != nil
		})).Return()
		progress.On("TooManyErrors").Return(nil)
	}

	setupResources := func(repoResources *resources.MockRepositoryResources, resourceClients *resources.MockResourceClients, mockClient *mockDynamicInterface, gvk schema.GroupVersionKind) {
		resourceClients.On("ForResource", resources.DashboardResource).Return(mockClient, gvk, nil)
		// The value is not saved
	}

	err := runExportTest(t, mockItems, setupProgress, setupResources)
	require.NoError(t, err)
}

func TestExportResources_Dashboards_V2Alpha1(t *testing.T) {
	mockItems := []unstructured.Unstructured{
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
						"storedVersion": "v2alpha1",
					},
				},
			},
		},
	}

	setupProgress := func(progress *jobs.MockJobProgressRecorder) {
		progress.On("SetMessage", mock.Anything, "start resource export").Return()
		progress.On("SetMessage", mock.Anything, "export dashboards").Return()
		progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
			return result.Name == "v2-dashboard" && result.Action == repository.FileActionCreated
		})).Return()
		progress.On("TooManyErrors").Return(nil)
	}

	setupResources := func(repoResources *resources.MockRepositoryResources, resourceClients *resources.MockResourceClients, mockClient *mockDynamicInterface, gvk schema.GroupVersionKind) {
		// Setup v1 client
		resourceClients.On("ForResource", resources.DashboardResource).Return(mockClient, gvk, nil)

		// Setup v2 client
		v2Dashboard := createV2DashboardObject("v2-dashboard", "v2alpha1")
		v2Client := &mockDynamicInterface{items: []unstructured.Unstructured{v2Dashboard}}
		resourceClients.On("ForResource", resources.DashboardResourceV2alpha1).Return(v2Client, gvk, nil)

		options := resources.WriteOptions{
			Path: "grafana",
			Ref:  "feature/branch",
		}
		repoResources.On("WriteResourceFileFromObject", mock.Anything, &v2Dashboard, options).Return("v2-dashboard.json", nil)
	}

	err := runExportTest(t, mockItems, setupProgress, setupResources)
	require.NoError(t, err)
}

func TestExportResources_Dashboards_V2Alpha1_ClientError(t *testing.T) {
	mockItems := []unstructured.Unstructured{
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
						"storedVersion": "v2alpha1",
					},
				},
			},
		},
	}

	setupProgress := func(progress *jobs.MockJobProgressRecorder) {
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
	}

	setupResources := func(repoResources *resources.MockRepositoryResources, resourceClients *resources.MockResourceClients, mockClient *mockDynamicInterface, gvk schema.GroupVersionKind) {
		resourceClients.On("ForResource", resources.DashboardResourceV2alpha1).Return(nil, gvk, fmt.Errorf("v2 client error"))
		resourceClients.On("ForResource", resources.DashboardResource).Return(mockClient, gvk, nil)
	}

	err := runExportTest(t, mockItems, setupProgress, setupResources)
	require.NoError(t, err)
}

func TestExportResources_Dashboards_V2beta1(t *testing.T) {
	mockItems := []unstructured.Unstructured{
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
						"storedVersion": "v2beta1",
					},
				},
			},
		},
	}

	setupProgress := func(progress *jobs.MockJobProgressRecorder) {
		progress.On("SetMessage", mock.Anything, "start resource export").Return()
		progress.On("SetMessage", mock.Anything, "export dashboards").Return()
		progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
			return result.Name == "v2-dashboard" && result.Action == repository.FileActionCreated
		})).Return()
		progress.On("TooManyErrors").Return(nil)
	}

	setupResources := func(repoResources *resources.MockRepositoryResources, resourceClients *resources.MockResourceClients, mockClient *mockDynamicInterface, gvk schema.GroupVersionKind) {
		// Setup v1 client
		resourceClients.On("ForResource", resources.DashboardResource).Return(mockClient, gvk, nil)

		// Setup v2 client
		v2Dashboard := createV2DashboardObject("v2-dashboard", "v2beta1")
		v2Client := &mockDynamicInterface{items: []unstructured.Unstructured{v2Dashboard}}
		resourceClients.On("ForResource", resources.DashboardResourceV2beta1).Return(v2Client, gvk, nil)

		options := resources.WriteOptions{
			Path: "grafana",
			Ref:  "feature/branch",
		}
		repoResources.On("WriteResourceFileFromObject", mock.Anything, &v2Dashboard, options).Return("v2-dashboard.json", nil)
	}

	err := runExportTest(t, mockItems, setupProgress, setupResources)
	require.NoError(t, err)
}

func TestExportResources_Dashboards_V2beta1_ClientError(t *testing.T) {
	mockItems := []unstructured.Unstructured{
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
						"storedVersion": "v2beta1",
					},
				},
			},
		},
	}

	setupProgress := func(progress *jobs.MockJobProgressRecorder) {
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
	}

	setupResources := func(repoResources *resources.MockRepositoryResources, resourceClients *resources.MockResourceClients, mockClient *mockDynamicInterface, gvk schema.GroupVersionKind) {
		resourceClients.On("ForResource", resources.DashboardResourceV2beta1).Return(nil, gvk, fmt.Errorf("v2 client error"))
		resourceClients.On("ForResource", resources.DashboardResource).Return(mockClient, gvk, nil)
	}

	err := runExportTest(t, mockItems, setupProgress, setupResources)
	require.NoError(t, err)
}

func TestExportResources_Dashboards_SkipsManagedResources(t *testing.T) {
	// Create a dashboard managed by file provisioning
	dashboard := createDashboardObject("managed-dashboard")

	// Add manager metadata using utils package
	meta, err := utils.MetaAccessor(&dashboard)
	require.NoError(t, err)
	meta.SetManagerProperties(utils.ManagerProperties{
		Kind:        utils.ManagerKindTerraform,
		Identity:    "terraform-provisioning",
		AllowsEdits: false,
		Suspended:   false,
	})

	mockItems := []unstructured.Unstructured{dashboard}

	setupProgress := func(progress *jobs.MockJobProgressRecorder) {
		progress.On("SetMessage", mock.Anything, "start resource export").Return()
		progress.On("SetMessage", mock.Anything, "export dashboards").Return()
		progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
			return result.Name == "managed-dashboard" && result.Action == repository.FileActionIgnored
		})).Return()
		progress.On("TooManyErrors").Return(nil).Maybe()
	}

	setupResources := func(repoResources *resources.MockRepositoryResources, resourceClients *resources.MockResourceClients, mockClient *mockDynamicInterface, gvk schema.GroupVersionKind) {
		resourceClients.On("ForResource", resources.DashboardResource).Return(mockClient, gvk, nil)
		// No WriteResourceFileFromObject call expected since resource should be skipped
	}

	err = runExportTest(t, mockItems, setupProgress, setupResources)
	require.NoError(t, err)
}
