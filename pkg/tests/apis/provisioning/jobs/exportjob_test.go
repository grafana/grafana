package jobs

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
)

func TestIntegrationProvisioning_ExportUnifiedToRepository(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	// Write dashboards at
	dashboard := helper.LoadYAMLOrJSONFile("../exportunifiedtorepository/dashboard-test-v0.yaml")
	_, err := helper.DashboardsV0.Resource.Create(ctx, dashboard, metav1.CreateOptions{})
	require.NoError(t, err, "should be able to create v0 dashboard")

	// FIXME: add helper and template for dashboards in different versions
	dashboard = helper.LoadYAMLOrJSONFile("../exportunifiedtorepository/dashboard-test-v1.yaml")
	_, err = helper.DashboardsV1.Resource.Create(ctx, dashboard, metav1.CreateOptions{})
	require.NoError(t, err, "should be able to create v1 dashboard")

	dashboard = helper.LoadYAMLOrJSONFile("../exportunifiedtorepository/dashboard-test-v2alpha1.yaml")
	_, err = helper.DashboardsV2alpha1.Resource.Create(ctx, dashboard, metav1.CreateOptions{})
	require.NoError(t, err, "should be able to create v2alpha1 dashboard")

	dashboard = helper.LoadYAMLOrJSONFile("../exportunifiedtorepository/dashboard-test-v2beta1.yaml")
	_, err = helper.DashboardsV2beta1.Resource.Create(ctx, dashboard, metav1.CreateOptions{})
	require.NoError(t, err, "should be able to create v2beta1 dashboard")

	// Now for the repository.
	const repo = "local-repository"
	testRepo := common.TestRepo{
		Name:               repo,
		SyncTarget:         "instance", // Export is only supported for instance sync
		Workflows:          []string{"write"},
		Copies:             map[string]string{}, // No initial files needed for export test
		ExpectedDashboards: 4,                   // 4 dashboards created above (v0, v1, v2alpha1, v2beta1)
		ExpectedFolders:    0,                   // No folders expected after sync
	}
	helper.CreateLocalRepo(t, testRepo)

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

	// Check that each file was exported with its stored version and new UIDs.
	// A dashboard created at v0 is relabeled to v1 on export: its body is already
	// the lossless v1 representation, and a file labeled v0alpha1 cannot be loaded
	// by the frontend dashboard loader once it is synced back in.
	for _, test := range []props{
		{title: "Test dashboard. Created at v0", apiVersion: "dashboard.grafana.app/v1", name: "test-v0", fileName: "test-dashboard-created-at-v0.json"},
		{title: "Test dashboard. Created at v1", apiVersion: "dashboard.grafana.app/v1", name: "test-v1", fileName: "test-dashboard-created-at-v1.json"},
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

		// Standalone export generates new UIDs — name must differ from original
		val, _, err = unstructured.NestedString(obj, "metadata", "name")
		require.NoError(t, err)
		require.NotEmpty(t, val, "exported file should have a metadata.name")
		require.NotEqual(t, test.name, val,
			"standalone export should generate a new UID for %s", test.title)

		require.Nil(t, obj["status"], "should not have a status element")
	}
}

func TestIntegrationProvisioning_ExportDashboardsWithStoredVersions(t *testing.T) {
	helper := sharedHelper(t)
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
			file: "../exportunifiedtorepository/dashboard-test-v0.yaml",
			createFunc: func(dashboard *unstructured.Unstructured, opts metav1.CreateOptions) (*unstructured.Unstructured, error) {
				return helper.DashboardsV0.Resource.Create(ctx, dashboard, opts)
			},
			expectedTitle: "Test dashboard. Created at v0",
			expectedName:  "test-v0",
			// v0 is relabeled to v1 on export so the synced file remains loadable;
			// see the conversion shim in jobs/export/resources.go.
			expectedVer: "dashboard.grafana.app/v1",
			fileName:    "test-dashboard-created-at-v0.json",
		},
		{
			name: "v1",
			file: "../exportunifiedtorepository/dashboard-test-v1.yaml",
			createFunc: func(dashboard *unstructured.Unstructured, opts metav1.CreateOptions) (*unstructured.Unstructured, error) {
				return helper.DashboardsV1.Resource.Create(ctx, dashboard, opts)
			},
			expectedTitle: "Test dashboard. Created at v1",
			expectedName:  "test-v1",
			expectedVer:   "dashboard.grafana.app/v1",
			fileName:      "test-dashboard-created-at-v1.json",
		},
		{
			name: "v2alpha1",
			file: "../exportunifiedtorepository/dashboard-test-v2alpha1.yaml",
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
			file: "../exportunifiedtorepository/dashboard-test-v2beta1.yaml",
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
		SyncTarget:         "instance", // Export is only supported for instance sync
		Workflows:          []string{"write"},
		Copies:             map[string]string{},
		ExpectedDashboards: len(tests),
		ExpectedFolders:    0,
	}
	helper.CreateLocalRepo(t, testRepo)

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

			// Verify the exported apiVersion. Non-v0 versions are preserved as stored;
			// v0 is relabeled to v1 so the synced file stays loadable.
			val, _, err := unstructured.NestedString(obj, "apiVersion")
			require.NoError(t, err)
			require.Equal(t, tt.expectedVer, val, "exported dashboard should have expected apiVersion")

			// Verify title
			val, _, err = unstructured.NestedString(obj, "spec", "title")
			require.NoError(t, err)
			require.Equal(t, tt.expectedTitle, val)

			// Standalone export generates new UIDs — name must differ from original
			val, _, err = unstructured.NestedString(obj, "metadata", "name")
			require.NoError(t, err)
			require.NotEmpty(t, val, "exported file should have a metadata.name")
			require.NotEqual(t, tt.expectedName, val,
				"standalone export should generate a new UID for %s", tt.name)

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
							// The exported apiVersion tracks the stored version, except v0
							// which is relabeled to v1 (see the export conversion shim).
							require.Equal(t, tt.expectedVer, exportedVersion,
								"exported version for dashboard %s should be %s (storedVersion=%s)", dashboardName, tt.expectedVer, storedVersion)
						}
					}
				}
			}
		}
	}
}
