package folderapiversion

import (
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/discovery"

	folderv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestMain(m *testing.M) {
	db.SetupTestDB()
	m.Run()
}

// TestIntegrationProvisioning_FolderAPIVersionDiscovery verifies that provisioning
// resolves the folder API version via discovery (the server's preferred version)
// rather than a configured value: the folders it creates carry whatever folder
// version the API server advertises as preferred.
func TestIntegrationProvisioning_FolderAPIVersionDiscovery(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := common.RunGrafana(t)
	ctx := t.Context()

	// Resolve the server's preferred folder version via discovery — this is the
	// same version provisioning is expected to use for the folders it writes.
	preferredVersion := serverPreferredFolderVersion(t, helper.K8sTestHelper)

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

	// Query folders via a client targeting the preferred version.
	folderGVR := folderv1.FolderResourceInfo.GroupVersionResource()
	folderGVR.Version = preferredVersion
	folderClient := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: "default",
		GVR:       folderGVR,
	})

	expectedAPIVersion := folderv1.APIGroup + "/" + preferredVersion

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
			assert.Equal(collect, expectedAPIVersion, f.GetAPIVersion(),
				"folder %s should use the discovered preferred apiVersion %s", f.GetName(), expectedAPIVersion)
		}
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault)
}

// serverPreferredFolderVersion returns the folder version the API server advertises
// as preferred, mirroring the discovery resolution provisioning performs internally.
func serverPreferredFolderVersion(t *testing.T, helper *apis.K8sTestHelper) string {
	t.Helper()

	dc, err := discovery.NewDiscoveryClientForConfig(helper.Org1.Admin.NewRestConfig())
	require.NoError(t, err)

	groups, err := dc.ServerPreferredResources()
	require.NoError(t, err)

	folderResource := folderv1.FolderResourceInfo.GroupVersionResource()
	for _, list := range groups {
		gv, err := schema.ParseGroupVersion(list.GroupVersion)
		if err != nil || gv.Group != folderResource.Group {
			continue
		}
		for _, r := range list.APIResources {
			if r.Name == folderResource.Resource {
				return gv.Version
			}
		}
	}

	t.Fatalf("no preferred version advertised for %s", folderResource.GroupResource())
	return ""
}
