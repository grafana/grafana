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
	"k8s.io/client-go/dynamic"
	k8srest "k8s.io/client-go/rest"

	dashboardV1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	searchV0 "github.com/grafana/grafana/pkg/apis/search/v0alpha1"
	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// Covers the endpoint end to end: the envelope, paging, and which items a
// non-admin sees.
//
// It deliberately does not claim to cover the verb restatement (a search POST
// parses as a create, and the chain restates it as a list). Dashboards authorize
// through NewServiceAuthorizer, whose coarse gate checks token permissions and
// leaves user permissions to the per-item check, so a search succeeds here with
// or without the restatement. That rule is covered by unit tests on the chain.
func TestIntegrationSearchAPI(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	ctx := context.Background()

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction:    true,
		DisableAnonymous:     true,
		APIServerStorageType: "unified",
		EnableSearchAPI:      true,
		UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
			"dashboards.dashboard.grafana.app": {DualWriterMode: rest.Mode5},
			"folders.folder.grafana.app":       {DualWriterMode: rest.Mode5},
		},
	})
	defer helper.Shutdown()

	gvr := schema.GroupVersionResource{
		Group:    dashboardV1.GROUP,
		Version:  dashboardV1.VERSION,
		Resource: "dashboards",
	}
	admin := helper.GetResourceClient(apis.ResourceClientArgs{User: helper.Org1.Admin, GVR: gvr})

	// The dashboards live in a folder the Viewer is granted View on. Without a
	// grant the search is still authorized, but every item is filtered out by
	// per-item authz, which would hide the thing this asserts.
	const folderUID = "searchapi-folder"
	createFolder(t, ctx, helper, folderUID, "Search API folder")
	viewerID, err := identity.UserIdentifier(helper.Org1.Viewer.Identity.GetID())
	require.NoError(t, err)
	setFolderPermissions(t, helper, helper.Org1.Admin, folderUID, []ResourcePermissionSetting{
		{UserID: &viewerID, Level: ResourcePermissionLevelView},
	})

	// Titles share a word so a text query matches the set, and differ so sorting
	// and paging are observable.
	titles := map[string]string{
		"searchapi-cpu":    "CPU saturation",
		"searchapi-memory": "Memory saturation",
		"searchapi-disk":   "Disk saturation",
	}
	for name, title := range titles {
		obj := &unstructured.Unstructured{Object: map[string]any{
			"spec": map[string]any{"title": title, "schemaVersion": 41},
		}}
		obj.SetName(name)
		obj.SetAPIVersion(gvr.GroupVersion().String())
		obj.SetKind("Dashboard")
		obj.SetAnnotations(map[string]string{utils.AnnoKeyFolder: folderUID})
		_, err := admin.Resource.Create(ctx, obj, metav1.CreateOptions{})
		require.NoError(t, err)
	}

	// Per-item authorization decides what a non-admin sees, so a viewer granted
	// View on the folder gets the dashboards in it.
	t.Run("a viewer sees what they were granted", func(t *testing.T) {
		results, code := search(t, ctx, helper.Org1.Viewer, gvr, searchV0.SearchQuery{
			Where: &searchV0.WhereNode{
				Text: &searchV0.TextPredicate{Value: "saturation"},
			},
			Limit: 10,
		})
		require.Equal(t, http.StatusOK, code)
		assert.Subset(t, names(results), []string{"searchapi-cpu", "searchapi-memory", "searchapi-disk"})
	})

	t.Run("returns the search envelope", func(t *testing.T) {
		results, code := search(t, ctx, helper.Org1.Admin, gvr, searchV0.SearchQuery{
			Where: &searchV0.WhereNode{
				Text: &searchV0.TextPredicate{Value: "saturation"},
			},
			Fields: []string{"title", "folder"},
			Limit:  10,
		})
		require.Equal(t, http.StatusOK, code)

		assert.Equal(t, searchV0.APIVERSION, results.APIVersion)
		assert.Equal(t, searchV0.KindSearchResults, results.Kind)
		require.NotEmpty(t, results.Items)

		item := results.Items[0]
		assert.Equal(t, gvr.Group, item.Resource.Group)
		assert.Equal(t, "dashboards", item.Resource.Resource)
		assert.Equal(t, "Dashboard", item.Resource.Kind)
		assert.NotEmpty(t, item.Resource.Name)

		// Ranked by a text query, so every item carries a score.
		require.NotNil(t, item.Score, "a text query should produce a score")

		require.NotNil(t, item.Fields)
		assert.Contains(t, item.Fields.Object, "title")

		assert.GreaterOrEqual(t, results.Metadata.TotalHits, int64(len(titles)))
		assert.Contains(t, []searchV0.TotalHitsRelation{"eq", "lte"}, results.Metadata.TotalHitsRelation)
	})

	t.Run("pages with the continue token", func(t *testing.T) {
		query := searchV0.SearchQuery{
			Where: &searchV0.WhereNode{
				Text: &searchV0.TextPredicate{Value: "saturation"},
			},
			Limit: 1,
		}

		seen := map[string]bool{}
		for page := 0; page < len(titles)+1; page++ {
			results, code := search(t, ctx, helper.Org1.Admin, gvr, query)
			require.Equal(t, http.StatusOK, code)
			for _, n := range names(results) {
				require.False(t, seen[n], "%s returned on more than one page", n)
				seen[n] = true
			}
			if results.Metadata.Continue == "" {
				break
			}
			query.Continue = results.Metadata.Continue
		}

		// Every dashboard seen exactly once, and paging terminated rather than
		// offering a token forever.
		for name := range titles {
			assert.True(t, seen[name], "%s never appeared across pages", name)
		}
	})

	// Field validation failures come back as Invalid, which carries the offending
	// field, rather than a bare bad request.
	t.Run("rejects a field the kind does not declare", func(t *testing.T) {
		_, code := search(t, ctx, helper.Org1.Admin, gvr, searchV0.SearchQuery{
			Sort:  []searchV0.SortField{{Field: "not-a-field"}},
			Limit: 10,
		})
		assert.Equal(t, http.StatusUnprocessableEntity, code)
	})

	// A malformed body cannot be validated at all, so it is a bad request.
	t.Run("rejects an unknown top-level field", func(t *testing.T) {
		code := postRaw(t, ctx, helper.Org1.Admin, gvr,
			[]byte(`{"apiVersion":"`+searchV0.APIVERSION+`","kind":"`+searchV0.KindSearchQuery+`","nope":1}`))
		assert.Equal(t, http.StatusBadRequest, code)
	})
}

// search posts a SearchQuery to the kind's search endpoint as user, returning the
// decoded envelope and the HTTP status. The status is returned rather than
// asserted so error cases can be checked too.
func search(
	t *testing.T,
	ctx context.Context,
	user apis.User,
	gvr schema.GroupVersionResource,
	query searchV0.SearchQuery,
) (searchV0.SearchResults, int) {
	t.Helper()

	query.APIVersion = searchV0.APIVERSION
	query.Kind = searchV0.KindSearchQuery
	body, err := json.Marshal(query)
	require.NoError(t, err)

	cfg := dynamic.ConfigFor(user.NewRestConfig())
	cfg.GroupVersion = &schema.GroupVersion{Group: gvr.Group, Version: gvr.Version}
	restClient, err := k8srest.RESTClientFor(cfg)
	require.NoError(t, err)

	var code int
	res := restClient.Post().
		AbsPath("apis", gvr.Group, gvr.Version, "namespaces", user.Identity.GetNamespace(), gvr.Resource, "search").
		Body(body).
		SetHeader("Content-type", "application/json").
		Do(ctx).
		StatusCode(&code)

	raw, rawErr := res.Raw()
	if code != http.StatusOK {
		return searchV0.SearchResults{}, code
	}
	require.NoError(t, rawErr, "body: %s", string(raw))

	var results searchV0.SearchResults
	require.NoError(t, json.Unmarshal(raw, &results), "body: %s", string(raw))
	return results, code
}

func names(results searchV0.SearchResults) []string {
	out := make([]string, 0, len(results.Items))
	for _, item := range results.Items {
		out = append(out, item.Resource.Name)
	}
	return out
}

// createFolder makes a folder through the legacy endpoint, which is what the
// other tests here use and what the permission endpoint expects to exist.
func createFolder(t *testing.T, ctx context.Context, helper *apis.K8sTestHelper, uid, title string) {
	t.Helper()
	cfg := dynamic.ConfigFor(helper.Org1.Admin.NewRestConfig())
	cfg.GroupVersion = &schema.GroupVersion{Group: "folder.grafana.app", Version: "v1beta1"}
	restClient, err := k8srest.RESTClientFor(cfg)
	require.NoError(t, err)

	var code int
	res := restClient.Post().AbsPath("api", "folders").
		Body([]byte(fmt.Sprintf(`{"uid":%q,"title":%q}`, uid, title))).
		SetHeader("Content-type", "application/json").
		Do(ctx).
		StatusCode(&code)
	require.NoError(t, res.Error())
	require.Equal(t, http.StatusOK, code)
}

// postRaw sends a body the typed helper could not produce, for cases where the
// point is that the request never decodes.
func postRaw(t *testing.T, ctx context.Context, user apis.User, gvr schema.GroupVersionResource, body []byte) int {
	t.Helper()
	cfg := dynamic.ConfigFor(user.NewRestConfig())
	cfg.GroupVersion = &schema.GroupVersion{Group: gvr.Group, Version: gvr.Version}
	restClient, err := k8srest.RESTClientFor(cfg)
	require.NoError(t, err)

	var code int
	restClient.Post().
		AbsPath("apis", gvr.Group, gvr.Version, "namespaces", user.Identity.GetNamespace(), gvr.Resource, "search").
		Body(body).
		SetHeader("Content-type", "application/json").
		Do(ctx).
		StatusCode(&code)
	return code
}
