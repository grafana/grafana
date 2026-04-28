package folderapiversion

import (
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	folderv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	folderv1beta1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestMain(m *testing.M) {
	db.SetupTestDB()
	m.Run()
}

func TestIntegrationProvisioning_FolderAPIVersionConfig(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	tests := []struct {
		name              string
		configuredVersion string
		expectedGroup     string
		expectedVersion   string
	}{
		{
			name:              "v1 creates folders via folder.grafana.app/v1",
			configuredVersion: "v1",
			expectedGroup:     folderv1.APIGroup,
			expectedVersion:   folderv1.APIVersion,
		},
		{
			name:              "v1beta1 creates folders via folder.grafana.app/v1beta1",
			configuredVersion: "v1beta1",
			expectedGroup:     folderv1beta1.APIGroup,
			expectedVersion:   folderv1beta1.APIVersion,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			helper := common.RunGrafana(t, common.WithFolderAPIVersion(tt.configuredVersion))
			ctx := t.Context()

			const repoName = "folder-version-repo"
			repoPath := filepath.Join(helper.ProvisioningPath, repoName)
			helper.CreateLocalRepo(t, common.TestRepo{
				Name:       repoName,
				LocalPath:  repoPath,
				SyncTarget: "folder",
				Copies: map[string]string{
					"../testdata/all-panels.json": "subfolder/dashboard.json",
				},
				SkipSync:               true,
				SkipResourceAssertions: true,
			})
			helper.SyncAndWait(t, repoName, nil)

			// Query folders via a client targeting the configured version.
			folderGVR := folderv1.FolderResourceInfo.GroupVersionResource()
			folderGVR.Version = tt.configuredVersion
			folderClient := helper.GetResourceClient(apis.ResourceClientArgs{
				User:      helper.Org1.Admin,
				Namespace: "default",
				GVR:       folderGVR,
			})

			require.EventuallyWithT(t, func(collect *assert.CollectT) {
				folders, err := folderClient.Resource.List(ctx, metav1.ListOptions{})
				if !assert.NoError(collect, err) {
					return
				}

				var managed []unstructured.Unstructured
				for _, f := range folders.Items {
					managerID, _, _ := unstructured.NestedString(f.Object, "metadata", "annotations", "grafana.app/managerId")
					if managerID == repoName {
						managed = append(managed, f)
					}
				}

				if !assert.GreaterOrEqual(collect, len(managed), 2, "should have at least root + subfolder") {
					return
				}

				for _, f := range managed {
					assert.Equal(collect, tt.expectedGroup+"/"+tt.expectedVersion, f.GetAPIVersion(),
						"folder %s should have apiVersion %s/%s", f.GetName(), tt.expectedGroup, tt.expectedVersion)
				}
			}, common.WaitTimeoutDefault, common.WaitIntervalDefault)
		})
	}
}
