package provisioning

import (
	"context"
	"encoding/json"
	"testing"

	dashboard "github.com/grafana/grafana/pkg/apis/dashboard/v1alpha1"
	folder "github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationProvisioning(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx := context.Background()
	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction: false, // required for experimental APIs
		EnableFeatureToggles: []string{
			featuremgmt.FlagProvisioning,
			featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
			featuremgmt.FlagKubernetesClientDashboardsFolders,
		},
		UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
			"dashboards.dashboard.grafana.app": {
				DualWriterMode: rest.Mode5,
			},
			"folders.folder.grafana.app": {
				DualWriterMode: rest.Mode5,
			},
		},
	})

	client := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: "default", // actually org1
		GVR:       provisioning.RepositoryResourceInfo.GroupVersionResource(),
	})

	folderClient := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: "default", // actually org1
		GVR:       folder.FolderResourceInfo.GroupVersionResource(),
	})

	dashboardClient := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: "default", // actually org1
		GVR:       dashboard.DashboardResourceInfo.GroupVersionResource(),
	})

	// Repo client, but less guard rails. Useful for subresources. We'll need this later...
	restClient := helper.Org1.Admin.RESTClient(t, &schema.GroupVersion{
		Group: "provisioning.grafana.app", Version: "v0alpha1",
	})
	_ = restClient

	cleanSlate := func(t *testing.T) {
		deleteAll := func(client *apis.K8sResourceClient) error {
			list, err := client.Resource.List(ctx, metav1.ListOptions{})
			if err != nil {
				return err
			}
			for _, resource := range list.Items {
				if err := client.Resource.Delete(ctx, resource.GetName(), metav1.DeleteOptions{}); err != nil {
					return err
				}
			}
			return nil
		}

		require.NoError(t, deleteAll(dashboardClient), "deleting all dashboards")
		require.NoError(t, deleteAll(folderClient), "deleting all folders")
		require.NoError(t, deleteAll(client), "deleting all repositories")
	}
	cleanSlate(t)

	t.Run("Creating and getting repositories", func(t *testing.T) {
		cleanSlate(t)

		createOptions := metav1.CreateOptions{FieldValidation: "Strict"}

		for _, inputFilePath := range []string{
			"testdata/local-devenv.json",
			"testdata/github-example.json",
		} {
			t.Run(inputFilePath, func(t *testing.T) {
				input := helper.LoadYAMLOrJSONFile(inputFilePath)
				expectedOutput, err := json.MarshalIndent(input.Object["spec"], "", "  ")
				require.NoError(t, err, "failed to marshal JSON from input spec")

				_, err = client.Resource.Create(ctx, input, createOptions)
				require.NoError(t, err, "failed to create resource")

				output, err := client.Resource.Get(ctx, mustNestedString(input.Object, "metadata", "name"), metav1.GetOptions{})
				require.NoError(t, err, "failed to read back resource")
				outputJSON, err := json.MarshalIndent(output.Object["spec"], "", "  ")
				require.NoError(t, err, "failed to marshal JSON from read back resource")

				require.JSONEq(t, string(expectedOutput), string(outputJSON))
			})
		}
	})
}

func mustNestedString(obj map[string]interface{}, fields ...string) string {
	v, _, _ := unstructured.NestedString(obj, fields...)
	return v
}
