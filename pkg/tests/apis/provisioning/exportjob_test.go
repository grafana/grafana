package provisioning

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationProvisioning_ExportUnifiedToRepository(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := common.RunGrafana(t)
	ctx := context.Background()

	// Write dashboards at
	dashboard := helper.LoadYAMLOrJSONFile("exportunifiedtorepository/dashboard-test-v0.yaml")
	_, err := helper.DashboardsV0.Resource.Create(ctx, dashboard, metav1.CreateOptions{})
	require.NoError(t, err, "should be able to create v0 dashboard")

	// FIXME: add helper and template for dashboards in different versions
	dashboard = helper.LoadYAMLOrJSONFile("exportunifiedtorepository/dashboard-test-v1.yaml")
	_, err = helper.DashboardsV1.Resource.Create(ctx, dashboard, metav1.CreateOptions{})
	require.NoError(t, err, "should be able to create v1 dashboard")

	dashboard = helper.LoadYAMLOrJSONFile("exportunifiedtorepository/dashboard-test-v2alpha1.yaml")
	_, err = helper.DashboardsV2alpha1.Resource.Create(ctx, dashboard, metav1.CreateOptions{})
	require.NoError(t, err, "should be able to create v2alpha1 dashboard")

	dashboard = helper.LoadYAMLOrJSONFile("exportunifiedtorepository/dashboard-test-v2beta1.yaml")
	_, err = helper.DashboardsV2beta1.Resource.Create(ctx, dashboard, metav1.CreateOptions{})
	require.NoError(t, err, "should be able to create v2beta1 dashboard")

	// Now for the repository.
	const repo = "local-repository"
	testRepo := common.TestRepo{
		Name:               repo,
		Target:             "instance",          // Export is only supported for instance sync
		Copies:             map[string]string{}, // No initial files needed for export test
		ExpectedDashboards: 4,                   // 4 dashboards created above (v0, v1, v2alpha1, v2beta1)
		ExpectedFolders:    0,                   // No folders expected after sync
	}
	helper.CreateRepo(t, testRepo)

	// Now export
	helper.DebugState(t, repo, "BEFORE EXPORT TO REPOSITORY")

	spec := provisioning.JobSpec{
		Action: provisioning.JobActionPush,
		Push: &provisioning.ExportJobOptions{
			Folder: "", // export entire instance
			Path:   "", // no prefix necessary for testing
		},
	}
	helper.TriggerJobAndWaitForSuccess(t, repo, spec)

	helper.DebugState(t, repo, "AFTER EXPORT TO REPOSITORY")

	type props struct {
		title      string
		apiVersion string
		name       string
		fileName   string
	}

	common.PrintFileTree(t, helper.ProvisioningPath)

	// Check that each file was exported with its stored version
	for _, test := range []props{
		{title: "Test dashboard. Created at v0", apiVersion: "dashboard.grafana.app/v0alpha1", name: "test-v0", fileName: "test-dashboard-created-at-v0.json"},
		{title: "Test dashboard. Created at v1", apiVersion: "dashboard.grafana.app/v1beta1", name: "test-v1", fileName: "test-dashboard-created-at-v1.json"},
		{title: "Test dashboard. Created at v2alpha1", apiVersion: "dashboard.grafana.app/v2alpha1", name: "test-v2alpha1", fileName: "test-dashboard-created-at-v2alpha1.json"},
		{title: "Test dashboard. Created at v2beta1", apiVersion: "dashboard.grafana.app/v2beta1", name: "test-v2beta1", fileName: "test-dashboard-created-at-v2beta1.json"},
	} {
		fpath := filepath.Join(helper.ProvisioningPath, test.fileName)
		//nolint:gosec // we are ok with reading files in testdata
		body, err := os.ReadFile(fpath)
		require.NoError(t, err, "exported file was not created at path %s", fpath)
		obj := map[string]any{}
		err = json.Unmarshal(body, &obj)
		require.NoError(t, err, "exported file not json %s", fpath)

		val, _, err := unstructured.NestedString(obj, "apiVersion")
		require.NoError(t, err)
		require.Equal(t, test.apiVersion, val)

		val, _, err = unstructured.NestedString(obj, "spec", "title")
		require.NoError(t, err)
		require.Equal(t, test.title, val)

		val, _, err = unstructured.NestedString(obj, "metadata", "name")
		require.NoError(t, err)
		require.Equal(t, test.name, val)

		require.Nil(t, obj["status"], "should not have a status element")
	}
}

func TestIntegrationProvisioning_ExportDashboardsWithStoredVersions(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := common.RunGrafana(t)
	ctx := context.Background()

	// Test table for different dashboard versions
	tests := []struct {
		name          string
		file          string
		createFunc    func(*unstructured.Unstructured, metav1.CreateOptions) (*unstructured.Unstructured, error)
		expectedTitle string
		expectedName  string
		expectedVer   string
		fileName      string
	}{
		{
			name: "v0alpha1",
			file: "exportunifiedtorepository/dashboard-test-v0.yaml",
			createFunc: func(dashboard *unstructured.Unstructured, opts metav1.CreateOptions) (*unstructured.Unstructured, error) {
				return helper.DashboardsV0.Resource.Create(ctx, dashboard, opts)
			},
			expectedTitle: "Test dashboard. Created at v0",
			expectedName:  "test-v0",
			expectedVer:   "dashboard.grafana.app/v0alpha1",
			fileName:      "test-dashboard-created-at-v0.json",
		},
		{
			name: "v1beta1",
			file: "exportunifiedtorepository/dashboard-test-v1.yaml",
			createFunc: func(dashboard *unstructured.Unstructured, opts metav1.CreateOptions) (*unstructured.Unstructured, error) {
				return helper.DashboardsV1.Resource.Create(ctx, dashboard, opts)
			},
			expectedTitle: "Test dashboard. Created at v1",
			expectedName:  "test-v1",
			expectedVer:   "dashboard.grafana.app/v1beta1",
			fileName:      "test-dashboard-created-at-v1.json",
		},
		{
			name: "v2alpha1",
			file: "exportunifiedtorepository/dashboard-test-v2alpha1.yaml",
			createFunc: func(dashboard *unstructured.Unstructured, opts metav1.CreateOptions) (*unstructured.Unstructured, error) {
				return helper.DashboardsV2alpha1.Resource.Create(ctx, dashboard, opts)
			},
			expectedTitle: "Test dashboard. Created at v2alpha1",
			expectedName:  "test-v2alpha1",
			expectedVer:   "dashboard.grafana.app/v2alpha1",
			fileName:      "test-dashboard-created-at-v2alpha1.json",
		},
		{
			name: "v2beta1",
			file: "exportunifiedtorepository/dashboard-test-v2beta1.yaml",
			createFunc: func(dashboard *unstructured.Unstructured, opts metav1.CreateOptions) (*unstructured.Unstructured, error) {
				return helper.DashboardsV2beta1.Resource.Create(ctx, dashboard, opts)
			},
			expectedTitle: "Test dashboard. Created at v2beta1",
			expectedName:  "test-v2beta1",
			expectedVer:   "dashboard.grafana.app/v2beta1",
			fileName:      "test-dashboard-created-at-v2beta1.json",
		},
	}

	// Create dashboards in different versions
	for _, tt := range tests {
		dashboard := helper.LoadYAMLOrJSONFile(tt.file)
		_, err := tt.createFunc(dashboard, metav1.CreateOptions{})
		require.NoError(t, err, "should be able to create %s dashboard", tt.name)
	}

	// Create repository
	const repo = "version-test-repository"
	testRepo := common.TestRepo{
		Name:               repo,
		Target:             "instance", // Export is only supported for instance sync
		Copies:             map[string]string{},
		ExpectedDashboards: len(tests),
		ExpectedFolders:    0,
	}
	helper.CreateRepo(t, testRepo)

	// Export dashboards
	spec := provisioning.JobSpec{
		Action: provisioning.JobActionPush,
		Push: &provisioning.ExportJobOptions{
			Folder: "",
			Path:   "",
		},
	}
	helper.TriggerJobAndWaitForSuccess(t, repo, spec)

	// Verify each dashboard was exported with its original stored version
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fpath := filepath.Join(helper.ProvisioningPath, tt.fileName)
			//nolint:gosec // we are ok with reading files in testdata
			body, err := os.ReadFile(fpath)
			require.NoError(t, err, "exported file was not created at path %s", fpath)

			obj := map[string]any{}
			err = json.Unmarshal(body, &obj)
			require.NoError(t, err, "exported file not json %s", fpath)

			// Verify API version matches the stored version
			val, _, err := unstructured.NestedString(obj, "apiVersion")
			require.NoError(t, err)
			require.Equal(t, tt.expectedVer, val, "exported dashboard should have original stored version")

			// Verify title
			val, _, err = unstructured.NestedString(obj, "spec", "title")
			require.NoError(t, err)
			require.Equal(t, tt.expectedTitle, val)

			// Verify name
			val, _, err = unstructured.NestedString(obj, "metadata", "name")
			require.NoError(t, err)
			require.Equal(t, tt.expectedName, val)

			// Verify no status field in exported file
			require.Nil(t, obj["status"], "exported file should not have status element")
		})
	}

	// Verify that listing via v1 API shows storedVersion when conversion fails
	// This tests the generic version handling logic
	dashboards, err := helper.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
	require.NoError(t, err, "should be able to list dashboards via v1 API")

	for _, dashboard := range dashboards.Items {
		// Check if there's a storedVersion in conversion status
		status, found, _ := unstructured.NestedMap(dashboard.Object, "status")
		if found && status != nil {
			conversion, convFound, _ := unstructured.NestedMap(status, "conversion")
			if convFound && conversion != nil {
				storedVersion, storedFound, _ := unstructured.NestedString(conversion, "storedVersion")
				if storedFound && storedVersion != "" {
					// Verify that the storedVersion is preserved during export
					// by checking the exported file has the correct version
					dashboardName := dashboard.GetName()
					for _, tt := range tests {
						if tt.expectedName == dashboardName {
							fpath := filepath.Join(helper.ProvisioningPath, tt.fileName)
							//nolint:gosec // we are ok with reading files in testdata
							body, err := os.ReadFile(fpath)
							require.NoError(t, err, "exported file should exist for %s", dashboardName)

							obj := map[string]any{}
							err = json.Unmarshal(body, &obj)
							require.NoError(t, err)

							exportedVersion, _, err := unstructured.NestedString(obj, "apiVersion")
							require.NoError(t, err)
							// Extract version from apiVersion (e.g., "dashboard.grafana.app/v2alpha1" -> "v2alpha1")
							expectedVersion := "dashboard.grafana.app/" + storedVersion
							require.Equal(t, expectedVersion, exportedVersion,
								"exported version should match storedVersion %s for dashboard %s", storedVersion, dashboardName)
						}
					}
				}
			}
		}
	}
}

func TestIntegrationProvisioning_ExportWithGenerateNewUIDs(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := common.RunGrafana(t)
	ctx := context.Background()

	// Create dashboards with known names
	dashboard1 := helper.LoadYAMLOrJSONFile("exportunifiedtorepository/dashboard-test-v1.yaml")
	created1, err := helper.DashboardsV1.Resource.Create(ctx, dashboard1, metav1.CreateOptions{})
	require.NoError(t, err, "should create first dashboard")
	originalName1 := created1.GetName()

	dashboard2 := helper.LoadYAMLOrJSONFile("exportunifiedtorepository/dashboard-test-v2beta1.yaml")
	created2, err := helper.DashboardsV2beta1.Resource.Create(ctx, dashboard2, metav1.CreateOptions{})
	require.NoError(t, err, "should create second dashboard")
	originalName2 := created2.GetName()

	t.Logf("Original dashboard names: %s, %s", originalName1, originalName2)

	const repo = "export-new-uids-repo"
	testRepo := common.TestRepo{
		Name:               repo,
		Target:             "instance",
		Copies:             map[string]string{},
		ExpectedDashboards: 2,
		ExpectedFolders:    0,
	}
	helper.CreateRepo(t, testRepo)

	// Export with GenerateNewUIDs enabled
	spec := provisioning.JobSpec{
		Action: provisioning.JobActionPush,
		Push: &provisioning.ExportJobOptions{
			GenerateNewUIDs: true,
		},
	}
	helper.TriggerJobAndWaitForSuccess(t, repo, spec)

	common.PrintFileTree(t, helper.ProvisioningPath)

	// Read all exported files and verify the names are NOT the originals
	entries, err := os.ReadDir(helper.ProvisioningPath)
	require.NoError(t, err)

	var exportedNames []string
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		fpath := filepath.Join(helper.ProvisioningPath, entry.Name())
		//nolint:gosec
		body, err := os.ReadFile(fpath)
		require.NoError(t, err, "should read exported file %s", entry.Name())

		obj := map[string]any{}
		require.NoError(t, json.Unmarshal(body, &obj))

		name, _, err := unstructured.NestedString(obj, "metadata", "name")
		require.NoError(t, err)
		require.NotEmpty(t, name, "exported file should have a metadata.name")

		t.Logf("Exported file %s has metadata.name=%s", entry.Name(), name)
		exportedNames = append(exportedNames, name)
	}

	require.Len(t, exportedNames, 2, "should have exported 2 files")

	// None of the exported names should match the original dashboard names
	for _, exportedName := range exportedNames {
		require.NotEqual(t, originalName1, exportedName,
			"exported name should differ from original dashboard 1")
		require.NotEqual(t, originalName2, exportedName,
			"exported name should differ from original dashboard 2")
	}

	// The two exported names should be unique from each other
	require.NotEqual(t, exportedNames[0], exportedNames[1],
		"exported names should be unique")
}

func TestIntegrationProvisioning_ExportDisabledByConfiguration(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	// Run Grafana WITHOUT the export feature flag enabled
	helper := common.RunGrafana(t, common.WithoutExportFeatureFlag)

	// Create a repository
	const repo = "test-repository"
	testRepo := common.TestRepo{
		Name:   repo,
		Target: "instance",
	}
	helper.CreateRepo(t, testRepo)

	// Try to trigger an export job (it should fail)
	spec := provisioning.JobSpec{
		Action: provisioning.JobActionPush,
		Push: &provisioning.ExportJobOptions{
			Folder: "",
			Path:   "",
		},
	}

	// Trigger job and wait for it to complete (will fail)
	job := helper.TriggerJobAndWaitForComplete(t, repo, spec)

	// Check that job failed with the expected error message
	status, found, err := unstructured.NestedMap(job.Object, "status")
	require.NoError(t, err)
	require.True(t, found, "job should have status")

	state, found, err := unstructured.NestedString(status, "state")
	require.NoError(t, err)
	require.True(t, found)
	require.Equal(t, "error", state, "job should have error state")

	message, found, err := unstructured.NestedString(status, "message")
	require.NoError(t, err)
	require.True(t, found)
	require.Contains(t, message, "export functionality is disabled by configuration")
}
