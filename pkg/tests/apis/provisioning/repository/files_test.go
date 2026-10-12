package repository

import (
	"fmt"
	"net/http"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func TestIntegrationProvisioning_FilesResourceLookup(t *testing.T) {
	helper := sharedHelper(t)
	const repo = "files-resource-lookup"
	const dashboard = "files-lookup-dashboard"
	helper.WriteToProvisioningPath(t, repo+"/team-a/dashboard.json", common.DashboardJSON(dashboard, "Lookup dashboard", 1))
	helper.WriteToProvisioningPath(t, repo+"/team-a/README.md", []byte("# Team A"))
	helper.CreateLocalRepo(t, common.TestRepo{
		Name: repo, SyncTarget: "folder", LocalPath: filepath.Join(helper.ProvisioningPath, repo),
	})
	helper.RequireRepoDashboardCount(t, repo, 1)
	folders := helper.RequireRepoFolderCount(t, repo, 2)
	common.RequireDefaultRootFolderPermissions(t, helper, repo)
	var folderUID string
	for _, folder := range folders {
		if folder.GetAnnotations()["grafana.app/sourcePath"] == "team-a" {
			folderUID = folder.GetName()
		}
	}
	require.NotEmpty(t, folderUID)

	for _, version := range []string{"v0alpha1", "v1beta1"} {
		base := fmt.Sprintf("/apis/provisioning.grafana.app/%s/namespaces/default/repositories/%s/files/", version, repo)
		for _, user := range []apis.User{helper.Org1.Admin, helper.Org1.Editor, helper.Org1.Viewer} {
			t.Run(version+"/"+user.Identity.GetLogin(), func(t *testing.T) {
				for _, tt := range []struct{ path, resource, name string }{
					{"team-a/", "folders", folderUID},
					{"team-a/dashboard.json", "dashboards", dashboard},
				} {
					rsp := apis.DoRequest(helper.K8sTestHelper, apis.RequestParams{
						Method: http.MethodGet, Path: base + tt.path, User: user,
					}, &provisioning.ResourceWrapper{})
					require.Equal(t, http.StatusOK, rsp.Response.StatusCode, "%s: %s", tt.path, rsp.Body)
					require.Equal(t, tt.resource, rsp.Result.Resource.Type.Resource)
					metadata, ok := rsp.Result.Resource.Existing.Object["metadata"].(map[string]any)
					require.True(t, ok)
					require.Equal(t, tt.name, metadata["name"])
					if tt.resource == "folders" {
						require.Empty(t, rsp.Result.Resource.DryRun.Object)
					}
				}
			})
		}
		t.Run(version+"/listing remains a file list", func(t *testing.T) {
			rsp := apis.DoRequest(helper.K8sTestHelper, apis.RequestParams{
				Method: http.MethodGet, Path: base, User: helper.Org1.Admin,
			}, &provisioning.FileList{})
			require.Equal(t, http.StatusOK, rsp.Response.StatusCode, "%s", rsp.Body)
			paths := make([]string, 0, len(rsp.Result.Items))
			for _, file := range rsp.Result.Items {
				paths = append(paths, file.Path)
			}
			require.Contains(t, paths, "team-a/dashboard.json")
			require.Contains(t, paths, "team-a/README.md")
		})
		t.Run(version+"/missing folder does not return a generated identity", func(t *testing.T) {
			rsp := apis.DoRequest(helper.K8sTestHelper, apis.RequestParams{
				Method: http.MethodGet, Path: base + "missing/", User: helper.Org1.Viewer,
			}, &provisioning.ResourceWrapper{})
			require.Equal(t, http.StatusNotFound, rsp.Response.StatusCode, "%s", rsp.Body)
			require.Nil(t, rsp.Result)
		})
	}
}
