package repository

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/rest"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func TestIntegrationProvisioning_RepositoryResourceResolveAuthorization(t *testing.T) {
	helper := sharedHelper(t)
	const repo = "resource-lookup-auth"
	helper.CreateLocalRepo(t, common.TestRepo{
		Name: repo, SyncTarget: "folder",
		Copies: map[string]string{
			"../testdata/all-panels.json":   "visible/cpu.json",
			"../testdata/text-options.json": "hidden/secret.json",
		},
	})
	helper.RequireRepoDashboardCount(t, repo, 2)
	helper.RequireRepoFolderCount(t, repo, 3)

	all := &provisioning.ResourceList{}
	require.NoError(t, helper.AdminREST.Get().Namespace("default").Resource("repositories").Name(repo).SubResource("resources").Do(t.Context()).Into(all))
	var visibleFolder, hiddenFolder, visibleDashboard string
	for _, item := range all.Items {
		switch {
		case item.Resource == "folders" && strings.TrimSuffix(item.Path, "/") == "visible":
			visibleFolder = item.Name
		case item.Resource == "folders" && strings.TrimSuffix(item.Path, "/") == "hidden":
			hiddenFolder = item.Name
		case item.Resource == "dashboards" && item.Path == "visible/cpu.json":
			visibleDashboard = item.Name
		}
	}
	require.NotEmpty(t, visibleFolder)
	require.NotEmpty(t, hiddenFolder)
	require.NotEmpty(t, visibleDashboard)
	common.SetFolderPermissions(t, helper, repo)
	common.SetFolderPermissions(t, helper, hiddenFolder)
	common.SetFolderPermissions(t, helper, visibleFolder,
		common.RolePermission{Role: "Viewer", Permission: common.FolderPermissionView},
		common.RolePermission{Role: "Editor", Permission: common.FolderPermissionView})
	reader := helper.CreateUser("resource-lookup-reader", apis.Org1, org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{{
		Actions: []string{"dashboards:read"}, Resource: "dashboards", ResourceAttribute: "uid", ResourceID: visibleDashboard,
	}})

	for _, version := range []string{"v0alpha1", "v1beta1"} {
		t.Run(version, func(t *testing.T) {
			gv := schema.GroupVersion{Group: provisioning.GROUP, Version: version}
			t.Run("admin full listing", func(t *testing.T) {
				var listed provisioning.ResourceList
				err := helper.Org1.Admin.RESTClient(t, &gv).Get().Namespace("default").Resource("repositories").Name(repo).SubResource("resources").Do(t.Context()).Into(&listed)
				require.NoError(t, err)
				require.ElementsMatch(t, all.Items, listed.Items)
			})
			t.Run("route matching", func(t *testing.T) {
				for _, actor := range []struct {
					name  string
					user  apis.User
					admin bool
				}{
					{name: "admin", user: helper.Org1.Admin, admin: true},
					{name: "viewer", user: helper.Org1.Viewer},
				} {
					t.Run(actor.name, func(t *testing.T) {
						for _, tc := range []struct {
							name         string
							method       string
							suffix       string
							adminStatus  int
							viewerStatus int
						}{
							{"POST listing", http.MethodPost, "", http.StatusMethodNotAllowed, http.StatusForbidden},
							{"GET resolve", http.MethodGet, "/resolve", http.StatusMethodNotAllowed, http.StatusForbidden},
							{"GET unknown", http.MethodGet, "/other", http.StatusNotFound, http.StatusForbidden},
							{"POST unknown", http.MethodPost, "/other", http.StatusNotFound, http.StatusForbidden},
							{"POST resolve child", http.MethodPost, "/resolve/child", http.StatusNotFound, http.StatusForbidden},
							{"POST resolve trailing slash", http.MethodPost, "/resolve/", http.StatusNotFound, http.StatusForbidden},
							{"GET nested resolve", http.MethodGet, "/child/resources/resolve", http.StatusNotFound, http.StatusForbidden},
							{"POST nested resolve", http.MethodPost, "/child/resources/resolve", http.StatusNotFound, http.StatusNotFound},
							{"POST encoded nested resolve", http.MethodPost, "/child%2fresources%2fresolve", http.StatusNotFound, http.StatusNotFound},
							{"PUT resolve", http.MethodPut, "/resolve", http.StatusMethodNotAllowed, http.StatusForbidden},
							{"DELETE resolve", http.MethodDelete, "/resolve", http.StatusMethodNotAllowed, http.StatusForbidden},
						} {
							t.Run(tc.name, func(t *testing.T) {
								var body map[string]any
								result := apis.DoRequest(helper.K8sTestHelper, apis.RequestParams{
									User:   actor.user,
									Method: tc.method,
									Path:   fmt.Sprintf("/apis/%s/%s/namespaces/default/repositories/%s/resources%s", provisioning.GROUP, version, repo, tc.suffix),
									Body:   []byte(`{"paths":["visible/cpu.json","hidden/secret.json"]}`),
								}, &body)
								wantStatus := tc.viewerStatus
								if actor.admin {
									wantStatus = tc.adminStatus
								}
								require.Equal(t, wantStatus, result.Response.StatusCode, string(result.Body))
								require.NotContains(t, body, "items", "unsupported routes must not return the full listing")
								require.NotContains(t, body, "results", "unsupported routes must not resolve resources")
							})
						}
					})
				}
			})
			for _, actor := range []struct {
				name   string
				client *rest.RESTClient
			}{
				{"viewer", helper.Org1.Viewer.RESTClient(t, &gv)},
				{"editor", helper.Org1.Editor.RESTClient(t, &gv)},
				{"resource reader", reader.RESTClient(t, &gv)},
			} {
				t.Run(actor.name, func(t *testing.T) {
					resolve := func(paths []string) rest.Result {
						body, err := json.Marshal(provisioning.ResourceResolveRequest{Paths: paths})
						require.NoError(t, err)
						return actor.client.Post().Namespace("default").Resource("repositories").Name(repo).SubResource("resources", "resolve").Body(body).SetHeader("Content-Type", "application/json").Do(t.Context())
					}
					paths := []string{"hidden/secret.json", "visible/cpu.json", "missing.json", "visible/cpu.json", "visible", "visible/"}
					body, err := resolve(paths).Raw()
					require.NoError(t, err)
					var found provisioning.ResourceResolveResponse
					require.NoError(t, json.Unmarshal(body, &found))
					require.Len(t, found.Results, 5)
					require.Equal(t, provisioning.ResourceResolveResult{Path: "hidden/secret.json"}, found.Results[0])
					require.Equal(t, "visible/cpu.json", found.Results[1].Path)
					require.NotNil(t, found.Results[1].Resource)
					require.Equal(t, visibleDashboard, found.Results[1].Resource.Name)
					require.Equal(t, provisioning.ResourceResolveResult{Path: "missing.json"}, found.Results[2])
					for i, path := range []string{"visible", "visible/"} {
						require.Equal(t, path, found.Results[i+3].Path)
						if actor.name == "resource reader" {
							require.Nil(t, found.Results[i+3].Resource)
						} else {
							require.NotNil(t, found.Results[i+3].Resource)
							require.Equal(t, visibleFolder, found.Results[i+3].Resource.Name)
							require.Equal(t, "folders", found.Results[i+3].Resource.Resource)
						}
					}
					for _, invalid := range [][]string{nil, {}, {""}, {"/"}, {"../hidden/secret.json"}, {"visible/cpu.json", "/hidden/secret.json"}} {
						require.True(t, apierrors.IsBadRequest(resolve(invalid).Error()))
					}
					for _, path := range []string{"", "/", "visible/cpu.json"} {
						err := actor.client.Get().Namespace("default").Resource("repositories").Name(repo).SubResource("resources").Param("path", path).Do(t.Context()).Error()
						require.True(t, apierrors.IsForbidden(err), "full listing requires repository write permission, regardless of query")
					}
					for _, suffix := range []string{"", "other", "resolve/child"} {
						err := actor.client.Post().Namespace("default").Resource("repositories").Name(repo).SubResource("resources").Suffix(suffix).Body([]byte(`{"paths":["visible/cpu.json"]}`)).SetHeader("Content-Type", "application/json").Do(t.Context()).Error()
						require.True(t, apierrors.IsForbidden(err), "only the exact POST resolver delegates target authorization")
					}
				})
			}
		})
	}
}

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
		t.Run("admin can GET resources", func(t *testing.T) {
			var statusCode int
			result := helper.AdminREST.Get().
				Namespace("default").
				Resource("repositories").
				Name(repo).
				SubResource("resources").
				Do(t.Context()).StatusCode(&statusCode)

			require.NoError(t, result.Error(), "admin should be able to GET resources")
			require.Equal(t, http.StatusOK, statusCode, "should return 200 OK")
		})

		t.Run("editor cannot GET resources", func(t *testing.T) {
			var statusCode int
			result := helper.EditorREST.Get().
				Namespace("default").
				Resource("repositories").
				Name(repo).
				SubResource("resources").
				Do(t.Context()).StatusCode(&statusCode)

			require.Error(t, result.Error(), "editor should not be able to GET resources")
			require.Equal(t, http.StatusForbidden, statusCode, "should return 403 Forbidden")
			require.True(t, apierrors.IsForbidden(result.Error()), "error should be forbidden")
		})

		t.Run("viewer cannot GET resources", func(t *testing.T) {
			var statusCode int
			result := helper.ViewerREST.Get().
				Namespace("default").
				Resource("repositories").
				Name(repo).
				SubResource("resources").
				Do(t.Context()).StatusCode(&statusCode)

			require.Error(t, result.Error(), "viewer should not be able to GET resources")
			require.Equal(t, http.StatusForbidden, statusCode, "should return 403 Forbidden")
			require.True(t, apierrors.IsForbidden(result.Error()), "error should be forbidden")
		})
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
