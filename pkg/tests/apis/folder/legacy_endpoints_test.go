package folder

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/search/model"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// TestIntegrationLegacyFolderEndpointsContract asserts that the legacy
// /api/folders and /api/search responses remain unchanged after the apistore
// began storing root-level resources with an explicit folder.GeneralFolderUID
// ("general") annotation (see prepare.go verifyFolder).
//
// Specifically: root folders / dashboards must continue to surface an empty
// parentUid/folderUid (not "general") on every documented legacy response
// field, even though the underlying object now carries the annotation
// internally.
func TestIntegrationLegacyFolderEndpointsContract(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	if !db.IsTestDbSQLite() {
		t.Skip("test only on sqlite for now")
	}

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction:    true,
		DisableAnonymous:     true,
		APIServerStorageType: "unified",
	})

	client := helper.GetResourceClient(apis.ResourceClientArgs{
		User: helper.Org1.Admin,
		GVR:  gvr,
	})

	rootUID := "legacy-contract-root"
	childUID := "legacy-contract-child"

	// Create one folder at the root and one nested below it via the legacy
	// /api/folders POST endpoint. The root folder is the case most affected
	// by the annotation change because the apistore now mutates its folder
	// annotation to folder.GeneralFolderUID.
	rootCreate := apis.DoRequest(helper, apis.RequestParams{
		User:   client.Args.User,
		Method: http.MethodPost,
		Path:   "/api/folders",
		Body: []byte(`{
			"uid": "` + rootUID + `",
			"title": "Legacy contract root"
		}`),
	}, &dtos.Folder{})
	require.Equal(t, http.StatusOK, rootCreate.Response.StatusCode, string(rootCreate.Body))
	require.NotNil(t, rootCreate.Result)
	require.Equal(t, rootUID, rootCreate.Result.UID)
	require.Empty(t, rootCreate.Result.ParentUID,
		"POST /api/folders for a root folder must return an empty parentUid; got %q (body: %s)",
		rootCreate.Result.ParentUID, string(rootCreate.Body))

	childCreate := apis.DoRequest(helper, apis.RequestParams{
		User:   client.Args.User,
		Method: http.MethodPost,
		Path:   "/api/folders",
		Body: []byte(`{
			"uid": "` + childUID + `",
			"title": "Legacy contract child",
			"parentUid": "` + rootUID + `"
		}`),
	}, &dtos.Folder{})
	require.Equal(t, http.StatusOK, childCreate.Response.StatusCode, string(childCreate.Body))
	require.NotNil(t, childCreate.Result)
	require.Equal(t, rootUID, childCreate.Result.ParentUID,
		"POST /api/folders for a nested folder must echo the requested parentUid; got %q",
		childCreate.Result.ParentUID)

	t.Run("GET /api/folders/{uid} returns empty parentUid for root", func(t *testing.T) {
		resp := apis.DoRequest(helper, apis.RequestParams{
			User:   client.Args.User,
			Method: http.MethodGet,
			Path:   "/api/folders/" + rootUID,
		}, &dtos.Folder{})
		require.Equal(t, http.StatusOK, resp.Response.StatusCode, string(resp.Body))
		require.NotNil(t, resp.Result)
		require.Empty(t, resp.Result.ParentUID,
			"GET /api/folders/%s must return empty parentUid for a root folder; got %q (body: %s)",
			rootUID, resp.Result.ParentUID, string(resp.Body))

		// Also ensure the raw response body does not include a "general"
		// parentUid string anywhere, even via omitempty.
		require.NotContains(t, string(resp.Body), `"parentUid":"general"`,
			"raw response leaked the canonical \"general\" parent UID: %s", string(resp.Body))
	})

	t.Run("GET /api/folders/{uid} returns the parent for a nested folder", func(t *testing.T) {
		resp := apis.DoRequest(helper, apis.RequestParams{
			User:   client.Args.User,
			Method: http.MethodGet,
			Path:   "/api/folders/" + childUID,
		}, &dtos.Folder{})
		require.Equal(t, http.StatusOK, resp.Response.StatusCode, string(resp.Body))
		require.NotNil(t, resp.Result)
		require.Equal(t, rootUID, resp.Result.ParentUID)
		require.Len(t, resp.Result.Parents, 1)
		require.Equal(t, rootUID, resp.Result.Parents[0].UID)
		require.Empty(t, resp.Result.Parents[0].ParentUID,
			"the root ancestor in /api/folders/{uid}.parents must carry an empty parentUid; got %q",
			resp.Result.Parents[0].ParentUID)
	})

	t.Run("GET /api/folders lists root folders with empty parentUid", func(t *testing.T) {
		resp := apis.DoRequest(helper, apis.RequestParams{
			User:   client.Args.User,
			Method: http.MethodGet,
			Path:   "/api/folders",
		}, &[]dtos.FolderSearchHit{})
		require.Equal(t, http.StatusOK, resp.Response.StatusCode, string(resp.Body))
		require.NotNil(t, resp.Result)

		var foundRoot bool
		for _, hit := range *resp.Result {
			if hit.UID == rootUID {
				foundRoot = true
				require.Empty(t, hit.ParentUID,
					"GET /api/folders root listing must return empty parentUid for root folder %s; got %q",
					rootUID, hit.ParentUID)
			}
			require.NotEqual(t, folder.GeneralFolderUID, hit.ParentUID,
				"GET /api/folders leaked canonical %q parent for %s", folder.GeneralFolderUID, hit.UID)
		}
		require.True(t, foundRoot, "root folder %s missing from GET /api/folders response: %s", rootUID, string(resp.Body))
	})

	t.Run("GET /api/folders?parentUid={uid} lists children", func(t *testing.T) {
		resp := apis.DoRequest(helper, apis.RequestParams{
			User:   client.Args.User,
			Method: http.MethodGet,
			Path:   "/api/folders?parentUid=" + rootUID,
		}, &[]dtos.FolderSearchHit{})
		require.Equal(t, http.StatusOK, resp.Response.StatusCode, string(resp.Body))
		require.NotNil(t, resp.Result)

		var found bool
		for _, hit := range *resp.Result {
			if hit.UID == childUID {
				found = true
				require.Equal(t, rootUID, hit.ParentUID)
			}
		}
		require.True(t, found, "child folder %s missing from GET /api/folders?parentUid=%s response: %s",
			childUID, rootUID, string(resp.Body))
	})

	t.Run("GET /api/search?type=dash-folder returns empty folderUid for root", func(t *testing.T) {
		resp := apis.DoRequest(helper, apis.RequestParams{
			User:   client.Args.User,
			Method: http.MethodGet,
			Path:   "/api/search?type=dash-folder&limit=1000",
		}, &model.HitList{})
		require.Equal(t, http.StatusOK, resp.Response.StatusCode, string(resp.Body))
		require.NotNil(t, resp.Result)

		var rootHit, childHit *model.Hit
		for _, hit := range *resp.Result {
			h := hit
			switch hit.UID {
			case rootUID:
				rootHit = h
			case childUID:
				childHit = h
			}
			require.NotEqual(t, folder.GeneralFolderUID, hit.FolderUID,
				"/api/search leaked canonical %q folderUid for %s", folder.GeneralFolderUID, hit.UID)
		}
		require.NotNil(t, rootHit, "root folder missing from /api/search: %s", string(resp.Body))
		require.NotNil(t, childHit, "child folder missing from /api/search: %s", string(resp.Body))
		require.Empty(t, rootHit.FolderUID,
			"/api/search must return empty folderUid for root folder %s; got %q",
			rootUID, rootHit.FolderUID)
		require.Equal(t, rootUID, childHit.FolderUID)
	})
}

// TestIntegrationLegacyDashboardEndpointsContract asserts that the legacy
// /api/dashboards/* and /api/search responses for dashboards continue to use
// "" (not "general") for the root parent folder, mirroring the folder
// contract checked above.
func TestIntegrationLegacyDashboardEndpointsContract(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	if !db.IsTestDbSQLite() {
		t.Skip("test only on sqlite for now")
	}

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction:    true,
		DisableAnonymous:     true,
		APIServerStorageType: "unified",
	})

	user := helper.Org1.Admin

	// Create a target folder for the nested-dashboard case via the legacy API.
	parentUID := "legacy-dash-folder"
	folderCreate := apis.DoRequest(helper, apis.RequestParams{
		User:   user,
		Method: http.MethodPost,
		Path:   "/api/folders",
		Body:   []byte(`{"uid":"` + parentUID + `","title":"Dashboard parent"}`),
	}, &dtos.Folder{})
	require.Equal(t, http.StatusOK, folderCreate.Response.StatusCode, string(folderCreate.Body))

	rootDashUID := "legacy-root-dash"
	nestedDashUID := "legacy-nested-dash"

	// Save a dashboard at the root (no folderUid).
	rootSave := apis.DoRequest(helper, apis.RequestParams{
		User:   user,
		Method: http.MethodPost,
		Path:   "/api/dashboards/db",
		Body: []byte(`{
			"dashboard": {"uid": "` + rootDashUID + `", "title": "Root dash", "schemaVersion": 39},
			"overwrite": true
		}`),
	}, &map[string]any{})
	require.Equal(t, http.StatusOK, rootSave.Response.StatusCode, string(rootSave.Body))
	rootSaveBody := *rootSave.Result
	require.Equal(t, rootDashUID, rootSaveBody["uid"])
	// folderUid on the legacy save response is conventionally "" for root.
	if v, ok := rootSaveBody["folderUid"]; ok {
		require.Equal(t, "", v,
			"POST /api/dashboards/db must return folderUid:\"\" for a root dashboard; got %v", v)
	}
	require.NotContains(t, string(rootSave.Body), `"folderUid":"general"`,
		"POST /api/dashboards/db leaked canonical \"general\" folderUid: %s", string(rootSave.Body))

	// Save a dashboard inside the folder.
	nestedSave := apis.DoRequest(helper, apis.RequestParams{
		User:   user,
		Method: http.MethodPost,
		Path:   "/api/dashboards/db",
		Body: []byte(`{
			"dashboard": {"uid": "` + nestedDashUID + `", "title": "Nested dash", "schemaVersion": 39},
			"folderUid": "` + parentUID + `",
			"overwrite": true
		}`),
	}, &map[string]any{})
	require.Equal(t, http.StatusOK, nestedSave.Response.StatusCode, string(nestedSave.Body))
	nestedSaveBody := *nestedSave.Result
	require.Equal(t, nestedDashUID, nestedSaveBody["uid"])
	require.Equal(t, parentUID, nestedSaveBody["folderUid"])

	t.Run("GET /api/dashboards/uid/{uid} returns empty meta.folderUid for root", func(t *testing.T) {
		resp := apis.DoRequest(helper, apis.RequestParams{
			User:   user,
			Method: http.MethodGet,
			Path:   "/api/dashboards/uid/" + rootDashUID,
		}, &dtos.DashboardFullWithMeta{})
		require.Equal(t, http.StatusOK, resp.Response.StatusCode, string(resp.Body))
		require.NotNil(t, resp.Result)
		require.Equal(t, rootDashUID, resp.Result.Dashboard.Get("uid").MustString())
		require.Empty(t, resp.Result.Meta.FolderUid,
			"GET /api/dashboards/uid/%s must return empty meta.folderUid for a root dashboard; got %q",
			rootDashUID, resp.Result.Meta.FolderUid)
		require.NotContains(t, string(resp.Body), `"folderUid":"general"`,
			"GET /api/dashboards/uid/{uid} leaked canonical \"general\" folderUid: %s", string(resp.Body))
	})

	t.Run("GET /api/dashboards/uid/{uid} returns the folder for a nested dashboard", func(t *testing.T) {
		resp := apis.DoRequest(helper, apis.RequestParams{
			User:   user,
			Method: http.MethodGet,
			Path:   "/api/dashboards/uid/" + nestedDashUID,
		}, &dtos.DashboardFullWithMeta{})
		require.Equal(t, http.StatusOK, resp.Response.StatusCode, string(resp.Body))
		require.NotNil(t, resp.Result)
		require.Equal(t, parentUID, resp.Result.Meta.FolderUid)
	})

	t.Run("GET /api/search?type=dash-db returns empty folderUid for root dashboards", func(t *testing.T) {
		resp := apis.DoRequest(helper, apis.RequestParams{
			User:   user,
			Method: http.MethodGet,
			Path:   "/api/search?type=dash-db&limit=1000",
		}, &model.HitList{})
		require.Equal(t, http.StatusOK, resp.Response.StatusCode, string(resp.Body))
		require.NotNil(t, resp.Result)

		var rootHit, nestedHit *model.Hit
		for _, hit := range *resp.Result {
			h := hit
			switch hit.UID {
			case rootDashUID:
				rootHit = h
			case nestedDashUID:
				nestedHit = h
			}
			require.NotEqual(t, folder.GeneralFolderUID, hit.FolderUID,
				"/api/search leaked canonical %q folderUid for dashboard %s", folder.GeneralFolderUID, hit.UID)
		}
		require.NotNil(t, rootHit, "root dashboard missing from /api/search: %s", string(resp.Body))
		require.NotNil(t, nestedHit, "nested dashboard missing from /api/search: %s", string(resp.Body))
		require.Empty(t, rootHit.FolderUID,
			"/api/search must return empty folderUid for root dashboard %s; got %q",
			rootDashUID, rootHit.FolderUID)
		require.Equal(t, parentUID, nestedHit.FolderUID)
	})

	t.Run("k8s storage stamps the canonical general sentinel on root-parented resources", func(t *testing.T) {
		// Inverse of the legacy contract: the k8s representation carries
		// folder.GeneralFolderUID internally, even though the legacy
		// responses hide it as "".
		dashGVR := schema.GroupVersionResource{
			Group:    "dashboard.grafana.app",
			Version:  "v1beta1",
			Resource: "dashboards",
		}
		dashClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User: user,
			GVR:  dashGVR,
		})
		got, err := dashClient.Resource.Get(context.Background(), rootDashUID, metav1.GetOptions{})
		require.NoError(t, err)
		meta, err := utils.MetaAccessor(got)
		require.NoError(t, err)
		require.Equal(t, folder.GeneralFolderUID, meta.GetFolder(),
			"root dashboard %s should carry the %q folder annotation internally", rootDashUID, folder.GeneralFolderUID)

		gotFolder, err := helper.GetResourceClient(apis.ResourceClientArgs{
			User: user,
			GVR:  gvr,
		}).Resource.Get(context.Background(), parentUID, metav1.GetOptions{})
		require.NoError(t, err)
		folderMeta, err := utils.MetaAccessor(gotFolder)
		require.NoError(t, err)
		require.Equal(t, folder.GeneralFolderUID, folderMeta.GetFolder(),
			"root folder %s should carry the %q folder annotation internally", parentUID, folder.GeneralFolderUID)
	})
}
