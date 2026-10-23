package repository

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

func TestIntegrationProvisioning_ResourceLookup(t *testing.T) {
	helper := common.RunGrafana(t, func(opts *testinfra.GrafanaOpts) {
		opts.EnableFeatureToggles = append(opts.EnableFeatureToggles, featuremgmt.FlagProvisioningFolderMetadata)
	})
	const repo = "resource-lookup"
	for _, team := range []string{"everyone", "editors", "admins"} {
		dir := filepath.Join(helper.ProvisioningPath, team)
		require.NoError(t, os.MkdirAll(dir, 0o750))
		dashboard := fmt.Sprintf(`{"apiVersion":"dashboard.grafana.app/v0alpha1","kind":"Dashboard","metadata":{"name":%q},"spec":{"title":%q,"schemaVersion":41}}`, team, team)
		require.NoError(t, os.WriteFile(filepath.Join(dir, "cpu.json"), []byte(dashboard), 0o600))
	}
	require.NoError(t, os.WriteFile(filepath.Join(helper.ProvisioningPath, "everyone", "unrequested.json"), []byte(`{"apiVersion":"dashboard.grafana.app/v0alpha1","kind":"Dashboard","metadata":{"name":"unrequested"},"spec":{"title":"Unrequested","schemaVersion":41}}`), 0o600))
	helper.CreateLocalRepo(t, common.TestRepo{Name: repo, SyncTarget: "folder"})
	helper.RequireRepoDashboardCount(t, repo, 4)
	folders := helper.RequireRepoFolderCount(t, repo, 4)
	common.RequireDefaultRootFolderPermissions(t, helper, repo)
	common.SetFolderPermissions(t, helper, repo, common.RolePermission{Role: "Admin", Permission: common.FolderPermissionAdmin})
	for _, folder := range folders {
		switch strings.TrimSuffix(folder.GetAnnotations()["grafana.app/sourcePath"], "/") {
		case "everyone":
			common.SetFolderPermissions(t, helper, folder.GetName(),
				common.RolePermission{Role: "Viewer", Permission: common.FolderPermissionView},
				common.RolePermission{Role: "Editor", Permission: common.FolderPermissionEdit})
		case "editors":
			common.SetFolderPermissions(t, helper, folder.GetName(), common.RolePermission{Role: "Editor", Permission: common.FolderPermissionEdit})
		case "admins":
			common.SetFolderPermissions(t, helper, folder.GetName(), common.RolePermission{Role: "Admin", Permission: common.FolderPermissionAdmin})
		}
	}

	paths := []string{"/", "everyone/", "everyone/cpu.json", "editors/", "editors/cpu.json", "admins/", "admins/cpu.json", "missing.json", "everyone/cpu.json"}
	body, err := json.Marshal(map[string]any{"paths": paths})
	require.NoError(t, err)
	for _, version := range []string{"v0alpha1", "v1beta1"} {
		t.Run(version, func(t *testing.T) {
			gv := &schema.GroupVersion{Group: "provisioning.grafana.app", Version: version}
			for _, tc := range []struct {
				name string
				user apis.User
				want []string
			}{
				{"admin", helper.Org1.Admin, paths[:7]},
				{"editor", helper.Org1.Editor, []string{"everyone/", "everyone/cpu.json", "editors/", "editors/cpu.json"}},
				{"viewer", helper.Org1.Viewer, []string{"everyone/", "everyone/cpu.json"}},
			} {
				t.Run(tc.name, func(t *testing.T) {
					client := tc.user.RESTClient(t, gv)
					var status int
					raw, err := client.Post().Namespace("default").Resource("repositories").Name(repo).SubResource("resources").
						SetHeader("Content-Type", "application/json").Body(body).Do(t.Context()).StatusCode(&status).Raw()
					require.NoError(t, err, "%s", raw)
					require.Equal(t, http.StatusOK, status)
					var result provisioning.ResourceList
					require.NoError(t, json.Unmarshal(raw, &result))
					got := make([]string, 0, len(result.Items))
					for _, item := range result.Items {
						got = append(got, item.Path)
						require.NotEmpty(t, item.Name)
						require.Empty(t, item.Hash)
						require.Empty(t, item.Title)
					}
					require.ElementsMatch(t, tc.want, got)

					_, err = client.Get().Namespace("default").Resource("repositories").Name(repo).SubResource("resources").Do(t.Context()).StatusCode(&status).Raw()
					if tc.name == "admin" {
						require.NoError(t, err)
						require.Equal(t, http.StatusOK, status)
					} else {
						require.Error(t, err)
						require.Equal(t, http.StatusForbidden, status)
					}
				})
			}
			t.Run("invalid body", func(t *testing.T) {
				for _, body := range []string{`{}`, `{"paths":[]}`, `{"paths":["../cpu.json"]}`, `{"paths":["/absolute.json"]}`} {
					var status int
					_, err := helper.Org1.Viewer.RESTClient(t, gv).Post().Namespace("default").Resource("repositories").Name(repo).SubResource("resources").
						SetHeader("Content-Type", "application/json").Body([]byte(body)).Do(t.Context()).StatusCode(&status).Raw()
					require.Error(t, err)
					require.Equal(t, http.StatusBadRequest, status)
				}
			})
		})
	}
}
