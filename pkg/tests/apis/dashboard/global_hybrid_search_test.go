package dashboards

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/kube-openapi/pkg/spec3"

	dashboardV1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	searchV0 "github.com/grafana/grafana/pkg/apis/search/v0alpha1"
	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationGlobalHybridSearch(t *testing.T) {
	testinfra.RunWithFeatureToggle(t, featuremgmt.FlagAuthzUseLegacyCheck, testIntegrationGlobalHybridSearch)
}

func testIntegrationGlobalHybridSearch(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	t.Setenv(setting.EnvKey("unified_storage", "hybrid_search_default_resources"), "dashboard.grafana.app/dashboards,folder.grafana.app/folders")
	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction:        true,
		DisableAnonymous:         true,
		APIServerStorageType:     "unified",
		EnableGlobalHybridSearch: true,
		EnableGlobalSearch:       false,
		UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
			"dashboards.dashboard.grafana.app": {DualWriterMode: rest.Mode5},
			"folders.folder.grafana.app":       {DualWriterMode: rest.Mode5},
		},
	})
	defer helper.Shutdown()

	ctx := context.Background()
	gvr := schema.GroupVersionResource{Group: dashboardV1.GROUP, Version: dashboardV1.VERSION, Resource: "dashboards"}
	client := helper.GetResourceClient(apis.ResourceClientArgs{User: helper.Org1.Admin, GVR: gvr})
	viewerID, err := identity.UserIdentifier(helper.Org1.Viewer.Identity.GetID())
	require.NoError(t, err)
	for _, name := range []string{"hybrid-visible", "hybrid-hidden"} {
		createFolder(t, ctx, helper, name, "Saturation "+name)
		permissions := []ResourcePermissionSetting{}
		if name == "hybrid-visible" {
			permissions = append(permissions, ResourcePermissionSetting{UserID: &viewerID, Level: ResourcePermissionLevelView})
		}
		setFolderPermissions(t, helper, helper.Org1.Admin, name, permissions)
		// Sharing a name across types must still produce two distinct results.
		obj := &unstructured.Unstructured{Object: map[string]any{
			"spec": map[string]any{"title": "Saturation " + name, "schemaVersion": 41},
		}}
		obj.SetAPIVersion(gvr.GroupVersion().String())
		obj.SetKind("Dashboard")
		obj.SetName(name)
		obj.SetAnnotations(map[string]string{utils.AnnoKeyFolder: name})
		_, err := client.Resource.Create(ctx, obj, metav1.CreateOptions{})
		require.NoError(t, err)
	}

	query := searchV0.HybridSearchQuery{
		Query: "saturation",
		Resources: []searchV0.HybridSearchResource{
			{Group: gvr.Group, Resource: "dashboards"},
			{Group: "folder.grafana.app", Resource: "folders"},
		},
	}
	namespace := helper.Org1.Admin.Identity.GetNamespace()
	path := fmt.Sprintf("/apis/search.grafana.app/v0alpha1/namespaces/%s/global/search/hybrid", namespace)
	for _, tc := range []struct {
		name               string
		user               apis.User
		want               []string
		wantDashboardsOnly []string
	}{
		{"admin", helper.Org1.Admin, []string{"dashboards/hybrid-visible", "folders/hybrid-visible", "dashboards/hybrid-hidden", "folders/hybrid-hidden"}, []string{"dashboards/hybrid-visible", "dashboards/hybrid-hidden"}},
		{"viewer", helper.Org1.Viewer, []string{"dashboards/hybrid-visible", "folders/hybrid-visible"}, []string{"dashboards/hybrid-visible"}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			for _, search := range []struct {
				name  string
				query searchV0.HybridSearchQuery
				want  []string
			}{
				{"explicit resources", query, tc.want},
				{"default resources", searchV0.HybridSearchQuery{Query: query.Query}, tc.want},
				{"explicit dashboards only", searchV0.HybridSearchQuery{Query: query.Query, Resources: query.Resources[:1]}, tc.wantDashboardsOnly},
			} {
				t.Run(search.name, func(t *testing.T) {
					response := postHybridSearch(t, helper, tc.user, path, search.query)
					require.Equal(t, http.StatusOK, response.Response.StatusCode, string(response.Body))
					assert.Equal(t, searchV0.APIVERSION, response.Result.APIVersion)
					assert.Equal(t, searchV0.KindHybridSearchResults, response.Result.Kind)
					got := make([]string, 0, len(response.Result.Items))
					for _, item := range response.Result.Items {
						got = append(got, item.Resource.Resource+"/"+item.Resource.Name)
						assert.NotEmpty(t, item.Resource.Group)
						assert.NotEmpty(t, item.Resource.Kind)
						assert.NotEmpty(t, item.Chunks)
					}
					assert.ElementsMatch(t, search.want, got)
				})
			}
		})
	}

	t.Run("namespace isolation", func(t *testing.T) {
		response := postHybridSearch(t, helper, helper.OrgB.Viewer, path, query)
		assert.Equal(t, http.StatusForbidden, response.Response.StatusCode, string(response.Body))
	})
	t.Run("existing per-resource endpoint", func(t *testing.T) {
		path := fmt.Sprintf("/apis/%s/namespaces/%s/dashboards/search/hybrid", gvr.GroupVersion(), namespace)
		response := postHybridSearch(t, helper, helper.Org1.Viewer, path, searchV0.HybridSearchQuery{Query: "saturation"})
		require.Equal(t, http.StatusOK, response.Response.StatusCode, string(response.Body))
		require.Len(t, response.Result.Items, 1)
		assert.Equal(t, "hybrid-visible", response.Result.Items[0].Resource.Name)
	})
	t.Run("resource without hybrid opt-in", func(t *testing.T) {
		// Playlists omit hybrid opt-in in every served version.
		playlists := searchV0.HybridSearchResource{Group: "playlist.grafana.app", Resource: "playlists"}
		for _, version := range []string{"v0alpha1", "v1"} {
			resourcePath := fmt.Sprintf("/apis/%s/%s/namespaces/%s/playlists", playlists.Group, version, namespace)
			list := apis.DoRequest(helper, apis.RequestParams{User: helper.Org1.Admin, Path: resourcePath}, &unstructured.UnstructuredList{})
			require.Equal(t, http.StatusOK, list.Response.StatusCode, string(list.Body))
			response := postHybridSearch(t, helper, helper.Org1.Admin, resourcePath+"/search/hybrid", searchV0.HybridSearchQuery{Query: query.Query})
			assert.Equal(t, http.StatusNotFound, response.Response.StatusCode, string(response.Body))
		}
		for _, resources := range [][]searchV0.HybridSearchResource{
			{playlists},
			{query.Resources[0], playlists},
		} {
			response := postHybridSearch(t, helper, helper.Org1.Admin, path, searchV0.HybridSearchQuery{Query: query.Query, Resources: resources})
			require.Equal(t, http.StatusBadRequest, response.Response.StatusCode, string(response.Body))
			assert.Contains(t, string(response.Body), "hybrid search is not enabled for playlist.grafana.app/playlists")
			var body map[string]json.RawMessage
			require.NoError(t, json.Unmarshal(response.Body, &body))
			assert.NotContains(t, body, "items")
		}
	})
	t.Run("global lexical endpoint remains disabled", func(t *testing.T) {
		response := apis.DoRequest(helper, apis.RequestParams{
			User: helper.Org1.Admin, Method: http.MethodPost,
			Path: fmt.Sprintf("/apis/search.grafana.app/v0alpha1/namespaces/%s/global/search", namespace),
			Body: []byte(`{}`),
		}, &metav1.Status{})
		assert.Equal(t, http.StatusNotFound, response.Response.StatusCode, string(response.Body))
	})
}

func TestIntegrationGlobalHybridSearchDisabled(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	for _, enableGlobalHybrid := range []bool{false, true} {
		t.Run(fmt.Sprintf("enable_global_hybrid_api=%t", enableGlobalHybrid), func(t *testing.T) {
			if enableGlobalHybrid {
				t.Setenv(setting.EnvKey("grafana-apiserver", "enable_hybrid_api"), "false")
			}
			helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				AppModeProduction:        true,
				DisableAnonymous:         true,
				APIServerStorageType:     "unified",
				EnableGlobalHybridSearch: enableGlobalHybrid,
				EnableGlobalSearch:       true,
			})
			defer helper.Shutdown()
			path := fmt.Sprintf("/apis/search.grafana.app/v0alpha1/namespaces/%s/global/search", helper.Org1.Admin.Identity.GetNamespace())
			response := postHybridSearch(t, helper, helper.Org1.Admin, path+"/hybrid", searchV0.HybridSearchQuery{Query: "saturation"})
			assert.Equal(t, http.StatusNotFound, response.Response.StatusCode, string(response.Body))
			openapi := apis.DoRequest(helper, apis.RequestParams{
				User: helper.Org1.Admin, Path: "/openapi/v3/apis/search.grafana.app/v0alpha1",
			}, &spec3.OpenAPI{})
			require.Equal(t, http.StatusOK, openapi.Response.StatusCode, string(openapi.Body))
			require.NotNil(t, openapi.Result)
			require.NotNil(t, openapi.Result.Paths)
			const schemaPath = "/apis/search.grafana.app/v0alpha1/namespaces/{namespace}/global/search"
			assert.Contains(t, openapi.Result.Paths.Paths, schemaPath)
			assert.NotContains(t, openapi.Result.Paths.Paths, schemaPath+"/hybrid")
			// A malformed request proves the existing lexical handler remains mounted.
			lexical := apis.DoRequest(helper, apis.RequestParams{
				User: helper.Org1.Admin, Method: http.MethodPost, Path: path,
				Body: []byte("{"), ContentType: "application/json",
			}, &metav1.Status{})
			assert.Equal(t, http.StatusBadRequest, lexical.Response.StatusCode, string(lexical.Body))
		})
	}
}

func postHybridSearch(t *testing.T, helper *apis.K8sTestHelper, user apis.User, path string, query searchV0.HybridSearchQuery) apis.K8sResponse[searchV0.HybridSearchResults] {
	t.Helper()
	query.APIVersion = searchV0.APIVERSION
	query.Kind = searchV0.KindHybridSearchQuery
	body, err := json.Marshal(query)
	require.NoError(t, err)
	return apis.DoRequest(helper, apis.RequestParams{User: user, Method: http.MethodPost, Path: path, Body: body}, &searchV0.HybridSearchResults{})
}
