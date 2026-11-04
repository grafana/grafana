package collections

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	collections "github.com/grafana/grafana/apps/collections/pkg/apis/collections/v1alpha1"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func slideshowObject(name string, spec map[string]any) *unstructured.Unstructured {
	return &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": collections.SlideshowResourceInfo.GroupVersion().String(),
		"kind":       "Slideshow",
		"metadata":   map[string]any{"name": name, "namespace": "default"},
		"spec":       spec,
	}}
}

func TestIntegrationSlideshows(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction:    false, // required for experimental APIs
		DisableAnonymous:     true,
		EnableFeatureToggles: []string{featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs, featuremgmt.FlagPlaylistSlideshows},
	})

	gvr := collections.SlideshowResourceInfo.GroupVersionResource()
	admin := helper.GetResourceClient(apis.ResourceClientArgs{User: helper.Org1.Admin, GVR: gvr})
	viewer := helper.GetResourceClient(apis.ResourceClientArgs{User: helper.Org1.Viewer, GVR: gvr})
	ctx := context.Background()

	spec := map[string]any{
		"title":    "NOC wall",
		"interval": "5m",
		"items": []any{
			map[string]any{"group": "dashboard.grafana.app", "resource": "dashboards", "name": "cpu", "interval": "30s"},
			map[string]any{"group": "dashboard.grafana.app", "resource": "notebooks", "name": "nb1"},
			map[string]any{"group": "assistant.ext.grafana.app", "resource": "pages", "name": "p1"},
		},
	}

	t.Run("round trips through create, get, update, list and delete", func(t *testing.T) {
		created, err := admin.Resource.Create(ctx, slideshowObject("noc-wall", spec), metav1.CreateOptions{})
		require.NoError(t, err)
		require.Equal(t, "noc-wall", created.GetName())

		got, err := admin.Resource.Get(ctx, "noc-wall", metav1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, spec, got.Object["spec"])

		updatedSpec := map[string]any{"title": "NOC wall v2", "interval": "1m", "items": spec["items"].([]any)[:1]}
		got.Object["spec"] = updatedSpec
		updated, err := admin.Resource.Update(ctx, got, metav1.UpdateOptions{})
		require.NoError(t, err)
		require.Equal(t, updatedSpec, updated.Object["spec"])

		list, err := admin.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.Len(t, list.Items, 1)
		require.Equal(t, "noc-wall", list.Items[0].GetName())

		require.NoError(t, admin.Resource.Delete(ctx, "noc-wall", metav1.DeleteOptions{}))
		_, err = admin.Resource.Get(ctx, "noc-wall", metav1.GetOptions{})
		require.True(t, apierrors.IsNotFound(err), "expected not found, got %v", err)
	})

	t.Run("rejects an invalid slideshow with the validation message", func(t *testing.T) {
		bad := map[string]any{
			"title":    "",
			"interval": "1s",
			"items":    []any{map[string]any{"group": "", "resource": "dashboards", "name": "cpu"}},
		}
		_, err := admin.Resource.Create(ctx, slideshowObject("bad", bad), metav1.CreateOptions{})
		require.Error(t, err)
		require.True(t, apierrors.IsInvalid(err), "expected invalid, got %v", err)
		require.Contains(t, err.Error(), "spec.title")
		require.Contains(t, err.Error(), "spec.interval")
		require.Contains(t, err.Error(), "spec.items[0].group")
	})

	t.Run("stores a slideshow without items as an empty list", func(t *testing.T) {
		created, err := admin.Resource.Create(ctx,
			slideshowObject("no-items", map[string]any{"title": "Empty", "interval": "5m"}), metav1.CreateOptions{})
		require.NoError(t, err)

		items, found, err := unstructured.NestedSlice(created.Object, "spec", "items")
		require.NoError(t, err)
		require.True(t, found, "items should be present")
		require.Empty(t, items)
	})

	t.Run("viewers can read but not write", func(t *testing.T) {
		_, err := admin.Resource.Create(ctx, slideshowObject("shared", spec), metav1.CreateOptions{})
		require.NoError(t, err)

		_, err = viewer.Resource.Get(ctx, "shared", metav1.GetOptions{})
		require.NoError(t, err)

		_, err = viewer.Resource.Create(ctx, slideshowObject("viewer-made", spec), metav1.CreateOptions{})
		require.Error(t, err)
		require.True(t, apierrors.IsForbidden(err), "expected forbidden, got %v", err)
	})

	t.Run("access follows the org role while playlistsRBAC is off", func(t *testing.T) {
		checkSlideshowAccess(t, helper, slideshowAccess{
			// Users with no role keep the viewer-level read access playlists give them.
			noneCanRead: true,
		})
	})
}

// With the playlist permissions enforced, access follows playlists:read and playlists:write.
func TestIntegrationSlideshowsWithPlaylistsRBAC(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction: false,
		DisableAnonymous:  true,
		EnableFeatureToggles: []string{
			featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
			featuremgmt.FlagPlaylistsRBAC,
			featuremgmt.FlagPlaylistSlideshows,
		},
	})

	// Users with no role hold neither permission.
	checkSlideshowAccess(t, helper, slideshowAccess{noneCanRead: false})
}

type slideshowAccess struct {
	noneCanRead bool
}

// checkSlideshowAccess runs the same expectations for both toggle states: viewers read, editors
// and admins write, and service accounts follow their role. Only users with no role differ.
func checkSlideshowAccess(t *testing.T, helper *apis.K8sTestHelper, want slideshowAccess) {
	t.Helper()
	ctx := context.Background()
	gvr := collections.SlideshowResourceInfo.GroupVersionResource()
	spec := map[string]any{
		"title":    "Wall",
		"interval": "5m",
		"items":    []any{map[string]any{"group": "dashboard.grafana.app", "resource": "dashboards", "name": "cpu"}},
	}
	name := fmt.Sprintf("acl-%d", time.Now().UnixNano())

	org := helper.Org1
	byUser := func(u apis.User) *apis.K8sResourceClient {
		return helper.GetResourceClient(apis.ResourceClientArgs{User: u, GVR: gvr})
	}
	byToken := func(token string) *apis.K8sResourceClient {
		return helper.GetResourceClient(apis.ResourceClientArgs{ServiceAccountToken: token, Namespace: "default", GVR: gvr})
	}

	// An editor creates the slideshow the others try to read.
	_, err := byUser(org.Editor).Resource.Create(ctx, slideshowObject(name, spec), metav1.CreateOptions{})
	require.NoError(t, err, "editor creates")

	readers := map[string]*apis.K8sResourceClient{
		"viewer":                 byUser(org.Viewer),
		"editor":                 byUser(org.Editor),
		"admin":                  byUser(org.Admin),
		"viewer service account": byToken(org.ViewerServiceAccountToken),
		"editor service account": byToken(org.EditorServiceAccountToken),
	}
	for who, client := range readers {
		_, err := client.Resource.Get(ctx, name, metav1.GetOptions{})
		require.NoError(t, err, "%s reads", who)
		list, err := client.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err, "%s lists", who)
		require.NotEmpty(t, list.Items, who)
	}

	_, err = byUser(org.None).Resource.Get(ctx, name, metav1.GetOptions{})
	if want.noneCanRead {
		require.NoError(t, err, "a user with no role reads")
	} else {
		require.True(t, apierrors.IsForbidden(err), "a user with no role must not read, got %v", err)
	}

	// Writes: viewers, users with no role and viewer service accounts are refused.
	refused := map[string]*apis.K8sResourceClient{
		"viewer":                 byUser(org.Viewer),
		"none":                   byUser(org.None),
		"viewer service account": byToken(org.ViewerServiceAccountToken),
	}
	for who, client := range refused {
		_, err := client.Resource.Create(ctx, slideshowObject("refused-"+who[:3], spec), metav1.CreateOptions{})
		require.True(t, apierrors.IsForbidden(err), "%s must not create, got %v", who, err)
		require.True(t, apierrors.IsForbidden(client.Resource.Delete(ctx, name, metav1.DeleteOptions{})),
			"%s must not delete", who)
	}

	// Writers: editors, admins and editor service accounts.
	writers := map[string]*apis.K8sResourceClient{
		"editor":                 byUser(org.Editor),
		"admin":                  byUser(org.Admin),
		"editor service account": byToken(org.EditorServiceAccountToken),
	}
	for who, client := range writers {
		created := "made-" + who[:3] + fmt.Sprint(len(who))
		_, err := client.Resource.Create(ctx, slideshowObject(created, spec), metav1.CreateOptions{})
		require.NoError(t, err, "%s creates", who)
		require.NoError(t, client.Resource.Delete(ctx, created, metav1.DeleteOptions{}), "%s deletes", who)
	}
}

// With the toggle off the kind is not served at all and is not advertised, while stars next to it
// keep working. Requests are still authorized by the normal slideshow rules first, so callers who
// may not write are forbidden and only callers who may are told the kind does not exist. Nobody
// ever succeeds.
func TestIntegrationSlideshowsDisabled(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction:    false,
		DisableAnonymous:     true,
		EnableFeatureToggles: []string{featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs},
	})
	org := helper.Org1
	base := "/apis/collections.grafana.app/v1alpha1/namespaces/default/slideshows"
	body := []byte(`{"apiVersion":"collections.grafana.app/v1alpha1","kind":"Slideshow","metadata":{"name":"wall"},"spec":{"title":"Wall","interval":"5m","items":[]}}`)

	type actor struct {
		params apis.RequestParams
		// Statuses expected for reads and for writes.
		read, write int
	}
	bearer := func(token string) apis.RequestParams {
		return apis.RequestParams{Headers: map[string]string{"Authorization": "Bearer " + token}}
	}
	actors := map[string]actor{
		"admin":                  {apis.RequestParams{User: org.Admin}, http.StatusNotFound, http.StatusNotFound},
		"editor":                 {apis.RequestParams{User: org.Editor}, http.StatusNotFound, http.StatusNotFound},
		"editor service account": {bearer(org.EditorServiceAccountToken), http.StatusNotFound, http.StatusNotFound},
		"viewer":                 {apis.RequestParams{User: org.Viewer}, http.StatusNotFound, http.StatusForbidden},
		"viewer service account": {bearer(org.ViewerServiceAccountToken), http.StatusNotFound, http.StatusForbidden},
		"no role":                {apis.RequestParams{User: org.None}, http.StatusNotFound, http.StatusForbidden},
		"anonymous":              {apis.RequestParams{}, http.StatusUnauthorized, http.StatusUnauthorized},
	}

	requests := []struct {
		name, method, path string
		body               []byte
		contentType        string
		write              bool
	}{
		{"list", http.MethodGet, base, nil, "", false},
		{"get", http.MethodGet, base + "/wall", nil, "", false},
		{"watch", http.MethodGet, base + "?watch=true&timeoutSeconds=1", nil, "", false},
		{"create", http.MethodPost, base, body, "", true},
		{"patch", http.MethodPatch, base + "/wall", []byte(`{"metadata":{"labels":{"x":"y"}}}`), "application/merge-patch+json", true},
		{"delete", http.MethodDelete, base + "/wall", nil, "", true},
		{"delete collection", http.MethodDelete, base, nil, "", true},
	}

	for who, a := range actors {
		for _, r := range requests {
			params := a.params
			params.Method, params.Path, params.Body, params.ContentType = r.method, r.path, r.body, r.contentType
			rsp := apis.DoRequest(helper, params, &map[string]any{})

			want := a.read
			if r.write {
				want = a.write
			}
			// The org role rules do not let editors delete a whole collection, for playlists either.
			if r.name == "delete collection" && strings.Contains(who, "editor") {
				want = http.StatusForbidden
			}
			require.Equal(t, want, rsp.Response.StatusCode, "%s %s", who, r.name)
		}
	}

	resources, err := helper.NewDiscoveryClient().ServerResourcesForGroupVersion(collections.GroupVersion.String())
	require.NoError(t, err)
	names := make([]string, 0, len(resources.APIResources))
	for _, r := range resources.APIResources {
		names = append(names, r.Name)
	}
	require.Contains(t, names, "stars")
	require.NotContains(t, names, "slideshows")

	stars := helper.GetResourceClient(apis.ResourceClientArgs{User: org.Admin, GVR: collections.StarsResourceInfo.GroupVersionResource()})
	_, err = stars.Resource.List(context.Background(), metav1.ListOptions{})
	require.NoError(t, err, "stars are unaffected")
}
