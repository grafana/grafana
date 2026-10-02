package repository

import (
	"encoding/json"
	"fmt"
	"net/http"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func TestIntegrationProvisioning_RepositorySubresourcesAuthorization(t *testing.T) {
	helper := sharedHelper(t)

	const repo = "subresources-auth-test"
	testRepo := common.TestRepo{
		Name:       repo,
		SyncTarget: "folder",
		Copies:     map[string]string{}, // No files needed for this test
	}
	helper.CreateLocalRepo(t, testRepo)

	helper.RequireRepoDashboardCount(t, repo, 0)
	helper.RequireRepoFolderCount(t, repo, 1)

	t.Run("test subresource", func(t *testing.T) {
		newRepoConfig := map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Repository",
			"metadata": map[string]any{
				"finalizers": []string{
					"remove-orphan-resources",
					"cleanup",
				},
			},
			"spec": map[string]any{
				"title": "Test Configuration",
				"type":  "local",
				"local": map[string]any{
					"path": helper.ProvisioningPath,
				},
				"workflows": []string{"write"},
				"sync": map[string]any{
					"enabled":         true,
					"target":          "folder",
					"intervalSeconds": 10,
				},
			},
		}
		configBytes, err := json.Marshal(newRepoConfig)
		require.NoError(t, err)

		t.Run("admin can POST test", func(t *testing.T) {
			var statusCode int
			result := helper.AdminREST.Post().
				Namespace("default").
				Resource("repositories").
				Name("test-config-auth").
				SubResource("test").
				Body(configBytes).
				SetHeader("Content-Type", "application/json").
				Do(t.Context()).StatusCode(&statusCode)

			require.NoError(t, result.Error(), "admin should be able to POST test")
			require.Equal(t, http.StatusOK, statusCode, "should return 200 OK")
		})

		t.Run("editor cannot POST test", func(t *testing.T) {
			var statusCode int
			result := helper.EditorREST.Post().
				Namespace("default").
				Resource("repositories").
				Name("test-config-auth").
				SubResource("test").
				Body(configBytes).
				SetHeader("Content-Type", "application/json").
				Do(t.Context()).StatusCode(&statusCode)

			require.Error(t, result.Error(), "editor should not be able to POST test")
			require.Equal(t, http.StatusForbidden, statusCode, "should return 403 Forbidden")
			require.True(t, apierrors.IsForbidden(result.Error()), "error should be forbidden")
		})

		t.Run("viewer cannot POST test", func(t *testing.T) {
			var statusCode int
			result := helper.ViewerREST.Post().
				Namespace("default").
				Resource("repositories").
				Name("test-config-auth").
				SubResource("test").
				Body(configBytes).
				SetHeader("Content-Type", "application/json").
				Do(t.Context()).StatusCode(&statusCode)

			require.Error(t, result.Error(), "viewer should not be able to POST test")
			require.Equal(t, http.StatusForbidden, statusCode, "should return 403 Forbidden")
			require.True(t, apierrors.IsForbidden(result.Error()), "error should be forbidden")
		})
	})

	t.Run("resources subresource", func(t *testing.T) {
		common.RequireDefaultRootFolderPermissions(t, helper, repo)
		for _, version := range []string{"v0alpha1", "v1beta1"} {
			for _, user := range []apis.User{helper.Org1.Admin, helper.Org1.Editor, helper.Org1.Viewer} {
				t.Run(version+"/"+user.Identity.GetLogin(), func(t *testing.T) {
					requireRepositoryResources(t, user, version, repo, []string{"folder.grafana.app/folders/" + repo})
				})
			}
		}
	})

	t.Run("history subresource", func(t *testing.T) {
		t.Run("admin can GET history (or BadRequest if not supported)", func(t *testing.T) {
			var statusCode int
			result := helper.AdminREST.Get().
				Namespace("default").
				Resource("repositories").
				Name(repo).
				SubResource("history").
				Do(t.Context()).StatusCode(&statusCode)

			// Admin should pass authorization - may get BadRequest if repo doesn't support history
			// but should NOT get Forbidden (which would indicate authorization failure)
			if result.Error() != nil {
				require.False(t, apierrors.IsForbidden(result.Error()), "admin should not get Forbidden error")
				// Local repos don't support history, so BadRequest is expected
				require.True(t, apierrors.IsBadRequest(result.Error()) || statusCode == http.StatusBadRequest,
					"should get BadRequest if history not supported, not Forbidden")
			} else {
				require.Equal(t, http.StatusOK, statusCode, "should return 200 OK if history is supported")
			}
		})

		t.Run("editor cannot GET history", func(t *testing.T) {
			var statusCode int
			result := helper.EditorREST.Get().
				Namespace("default").
				Resource("repositories").
				Name(repo).
				SubResource("history").
				Do(t.Context()).StatusCode(&statusCode)

			require.Error(t, result.Error(), "editor should not be able to GET history")
			require.Equal(t, http.StatusForbidden, statusCode, "should return 403 Forbidden")
			require.True(t, apierrors.IsForbidden(result.Error()), "error should be forbidden")
		})

		t.Run("viewer cannot GET history", func(t *testing.T) {
			var statusCode int
			result := helper.ViewerREST.Get().
				Namespace("default").
				Resource("repositories").
				Name(repo).
				SubResource("history").
				Do(t.Context()).StatusCode(&statusCode)

			require.Error(t, result.Error(), "viewer should not be able to GET history")
			require.Equal(t, http.StatusForbidden, statusCode, "should return 403 Forbidden")
			require.True(t, apierrors.IsForbidden(result.Error()), "error should be forbidden")
		})
	})

	t.Run("status subresource", func(t *testing.T) {
		t.Run("admin can GET status", func(t *testing.T) {
			var statusCode int
			result := helper.AdminREST.Get().
				Namespace("default").
				Resource("repositories").
				Name(repo).
				SubResource("status").
				Do(t.Context()).StatusCode(&statusCode)

			require.NoError(t, result.Error(), "admin should be able to GET status")
			require.Equal(t, http.StatusOK, statusCode, "should return 200 OK")
		})

		t.Run("editor cannot GET status", func(t *testing.T) {
			var statusCode int
			result := helper.EditorREST.Get().
				Namespace("default").
				Resource("repositories").
				Name(repo).
				SubResource("status").
				Do(t.Context()).StatusCode(&statusCode)

			require.Error(t, result.Error(), "editor should not be able to GET status")
			require.Equal(t, http.StatusForbidden, statusCode, "should return 403 Forbidden")
			require.True(t, apierrors.IsForbidden(result.Error()), "error should be forbidden")
		})

		t.Run("viewer cannot GET status", func(t *testing.T) {
			var statusCode int
			result := helper.ViewerREST.Get().
				Namespace("default").
				Resource("repositories").
				Name(repo).
				SubResource("status").
				Do(t.Context()).StatusCode(&statusCode)

			require.Error(t, result.Error(), "viewer should not be able to GET status")
			require.Equal(t, http.StatusForbidden, statusCode, "should return 403 Forbidden")
			require.True(t, apierrors.IsForbidden(result.Error()), "error should be forbidden")
		})
	})
}

func TestIntegrationProvisioning_RepositoryResourcesVisibility(t *testing.T) {
	helper := sharedHelper(t)
	const repo = "resources-visibility"
	const sharedDashboard = "resources-shared-dashboard"
	const directDashboard = "resources-direct-dashboard"
	const deniedDashboard = "resources-denied-dashboard"

	helper.WriteToProvisioningPath(t, repo+"/shared/dashboard.json", common.DashboardJSON(sharedDashboard, "Shared dashboard", 1))
	helper.WriteToProvisioningPath(t, repo+"/private/direct.json", common.DashboardJSON(directDashboard, "Directly readable dashboard", 1))
	helper.WriteToProvisioningPath(t, repo+"/private/denied.json", common.DashboardJSON(deniedDashboard, "Denied dashboard", 1))
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       repo,
		SyncTarget: "folder",
		LocalPath:  filepath.Join(helper.ProvisioningPath, repo),
	})
	helper.RequireRepoDashboardCount(t, repo, 3)
	folders := helper.RequireRepoFolderCount(t, repo, 3)
	common.RequireDefaultRootFolderPermissions(t, helper, repo)
	common.SetFolderPermissions(t, helper, repo)

	var sharedFolder, privateFolder string
	for _, folder := range folders {
		switch folder.GetAnnotations()["grafana.app/sourcePath"] {
		case "shared":
			sharedFolder = folder.GetName()
		case "private":
			privateFolder = folder.GetName()
		}
	}
	require.NotEmpty(t, sharedFolder)
	require.NotEmpty(t, privateFolder)
	common.SetFolderPermissions(t, helper, sharedFolder,
		common.RolePermission{Role: "Viewer", Permission: common.FolderPermissionView},
		common.RolePermission{Role: "Editor", Permission: common.FolderPermissionView},
	)
	common.SetFolderPermissions(t, helper, privateFolder)
	viewerID, err := identity.UserIdentifier(helper.Org1.Viewer.Identity.GetID())
	require.NoError(t, err)
	_, code, err := common.PostHelper(t, *helper.K8sTestHelper,
		fmt.Sprintf("/api/dashboards/uid/%s/permissions", directDashboard),
		map[string]any{"items": []map[string]any{{"userId": viewerID, "permission": common.FolderPermissionView}}},
		helper.Org1.Admin,
	)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, code)

	const otherRepo = "resources-other-repo"
	helper.WriteToProvisioningPath(t, otherRepo+"/dashboard.json", common.DashboardJSON("other-repo-dashboard", "Other repository dashboard", 1))
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       otherRepo,
		SyncTarget: "folder",
		LocalPath:  filepath.Join(helper.ProvisioningPath, otherRepo),
	})
	helper.RequireRepoDashboardCount(t, otherRepo, 1)
	common.RequireDefaultRootFolderPermissions(t, helper, otherRepo)

	for _, version := range []string{"v0alpha1", "v1beta1"} {
		t.Run(version, func(t *testing.T) {
			t.Run("admin sees every managed resource", func(t *testing.T) {
				requireRepositoryResources(t, helper.Org1.Admin, version, repo, []string{
					"folder.grafana.app/folders/" + repo,
					"folder.grafana.app/folders/" + sharedFolder,
					"folder.grafana.app/folders/" + privateFolder,
					"dashboard.grafana.app/dashboards/" + sharedDashboard,
					"dashboard.grafana.app/dashboards/" + directDashboard,
					"dashboard.grafana.app/dashboards/" + deniedDashboard,
				})
			})
			t.Run("editor sees readable folder and its dashboard", func(t *testing.T) {
				requireRepositoryResources(t, helper.Org1.Editor, version, repo, []string{
					"folder.grafana.app/folders/" + sharedFolder,
					"dashboard.grafana.app/dashboards/" + sharedDashboard,
				})
			})
			t.Run("direct dashboard access does not expose parent folder", func(t *testing.T) {
				requireRepositoryResources(t, helper.Org1.Viewer, version, repo, []string{
					"folder.grafana.app/folders/" + sharedFolder,
					"dashboard.grafana.app/dashboards/" + sharedDashboard,
					"dashboard.grafana.app/dashboards/" + directDashboard,
				})
			})
			t.Run("user from another namespace cannot list resources", func(t *testing.T) {
				client := helper.OrgB.Viewer.RESTClient(t, &schema.GroupVersion{Group: "provisioning.grafana.app", Version: version})
				var statusCode int
				result := client.Get().
					Namespace("default").
					Resource("repositories").
					Name(repo).
					SubResource("resources").
					Do(t.Context()).StatusCode(&statusCode)
				require.True(t, apierrors.IsForbidden(result.Error()), "another namespace must not be searchable")
				require.Equal(t, http.StatusForbidden, statusCode)
			})
		})
	}
}

func TestIntegrationProvisioning_RepositoryResourcesDecreasingVisibilityByRole(t *testing.T) {
	helper := sharedHelper(t)
	const repo = "resources-role-visibility"
	const sharedDashboard = "resources-role-shared"
	const editorDashboard = "resources-role-editors"
	const privateDashboard = "resources-role-private"

	helper.WriteToProvisioningPath(t, repo+"/shared/dashboard.json", common.DashboardJSON(sharedDashboard, "Shared dashboard", 1))
	helper.WriteToProvisioningPath(t, repo+"/editors/dashboard.json", common.DashboardJSON(editorDashboard, "Editors dashboard", 1))
	helper.WriteToProvisioningPath(t, repo+"/private/dashboard.json", common.DashboardJSON(privateDashboard, "Private dashboard", 1))
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       repo,
		SyncTarget: "folder",
		LocalPath:  filepath.Join(helper.ProvisioningPath, repo),
	})
	helper.RequireRepoDashboardCount(t, repo, 3)
	folders := helper.RequireRepoFolderCount(t, repo, 4)
	common.RequireDefaultRootFolderPermissions(t, helper, repo)
	common.SetFolderPermissions(t, helper, repo)

	folderUIDs := make(map[string]string, len(folders))
	for _, folder := range folders {
		folderUIDs[folder.GetAnnotations()["grafana.app/sourcePath"]] = folder.GetName()
	}
	for _, path := range []string{"shared", "editors", "private"} {
		require.NotEmpty(t, folderUIDs[path], "expected folder for %s", path)
	}
	common.SetFolderPermissions(t, helper, folderUIDs["shared"],
		common.RolePermission{Role: "Viewer", Permission: common.FolderPermissionView},
		common.RolePermission{Role: "Editor", Permission: common.FolderPermissionView},
	)
	common.SetFolderPermissions(t, helper, folderUIDs["editors"],
		common.RolePermission{Role: "Editor", Permission: common.FolderPermissionView},
	)
	common.SetFolderPermissions(t, helper, folderUIDs["private"])

	tests := []struct {
		name     string
		user     apis.User
		expected []string
	}{
		{
			name: "admin sees all seven resources",
			user: helper.Org1.Admin,
			expected: []string{
				"folder.grafana.app/folders/" + repo,
				"folder.grafana.app/folders/" + folderUIDs["shared"],
				"folder.grafana.app/folders/" + folderUIDs["editors"],
				"folder.grafana.app/folders/" + folderUIDs["private"],
				"dashboard.grafana.app/dashboards/" + sharedDashboard,
				"dashboard.grafana.app/dashboards/" + editorDashboard,
				"dashboard.grafana.app/dashboards/" + privateDashboard,
			},
		},
		{
			name: "editor sees four shared and editor resources",
			user: helper.Org1.Editor,
			expected: []string{
				"folder.grafana.app/folders/" + folderUIDs["shared"],
				"folder.grafana.app/folders/" + folderUIDs["editors"],
				"dashboard.grafana.app/dashboards/" + sharedDashboard,
				"dashboard.grafana.app/dashboards/" + editorDashboard,
			},
		},
		{
			name: "viewer sees only two shared resources",
			user: helper.Org1.Viewer,
			expected: []string{
				"folder.grafana.app/folders/" + folderUIDs["shared"],
				"dashboard.grafana.app/dashboards/" + sharedDashboard,
			},
		},
	}
	for _, version := range []string{"v0alpha1", "v1beta1"} {
		t.Run(version, func(t *testing.T) {
			for _, tt := range tests {
				t.Run(tt.name, func(t *testing.T) {
					requireRepositoryResources(t, tt.user, version, repo, tt.expected)
				})
			}
		})
	}
}

func requireRepositoryResources(t *testing.T, user apis.User, version, repo string, expected []string) {
	t.Helper()
	client := user.RESTClient(t, &schema.GroupVersion{Group: "provisioning.grafana.app", Version: version})
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		var statusCode int
		body, err := client.Get().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("resources").
			Do(t.Context()).StatusCode(&statusCode).Raw()
		if !assert.NoError(c, err) || !assert.Equal(c, http.StatusOK, statusCode) {
			return
		}
		var result provisioning.ResourceList
		if !assert.NoError(c, json.Unmarshal(body, &result)) {
			return
		}
		assert.Equal(c, "ResourceList", result.Kind)
		assert.Equal(c, "provisioning.grafana.app/"+version, result.APIVersion)
		identities := make([]string, 0, len(result.Items))
		for _, item := range result.Items {
			identities = append(identities, item.Group+"/"+item.Resource+"/"+item.Name)
		}
		assert.ElementsMatch(c, expected, identities)
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault)
}
