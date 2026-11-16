package resources

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/client-go/rest"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// serveResources stands up the repository resources subresource, answering each request with the
// status and body the handler returns, and records the URIs it was asked for.
func serveResources(t *testing.T, pageSize int64, handler func(*http.Request) (int, any)) (*ResourceListerFromProvisioningAPI, *[]string) {
	t.Helper()
	var paths []string

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		paths = append(paths, r.Method+" "+r.URL.RequestURI())
		code, body := handler(r)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(code)
		require.NoError(t, json.NewEncoder(w).Encode(body))
	}))
	t.Cleanup(srv.Close)

	scheme := runtime.NewScheme()
	require.NoError(t, provisioning.AddToScheme(scheme))
	metav1.AddToGroupVersion(scheme, schema.GroupVersion{Version: "v1"})
	gv := schema.GroupVersion{Group: provisioning.GROUP, Version: provisioning.VERSION}
	client, err := rest.RESTClientFor(&rest.Config{
		Host:    srv.URL,
		APIPath: "/apis",
		ContentConfig: rest.ContentConfig{
			GroupVersion:         &gv,
			NegotiatedSerializer: serializer.NewCodecFactory(scheme).WithoutConversion(),
		},
	})
	require.NoError(t, err)

	return NewResourceListerFromProvisioningAPI(client, pageSize), &paths
}

func TestResourceListerFromProvisioningAPI_List(t *testing.T) {
	items := []provisioning.ResourceListItem{
		{Path: "dashboard.json", Group: "dashboard.grafana.app", Resource: "dashboards", Name: "db-1", Hash: "abc", Title: "Dashboard 1"},
		{Path: "nested/", Group: "folder.grafana.app", Resource: "folders", Name: "fld-1"},
	}
	lister, paths := serveResources(t, 0, func(*http.Request) (int, any) {
		return http.StatusOK, &provisioning.ResourceList{
			TypeMeta: metav1.TypeMeta{APIVersion: provisioning.APIVERSION, Kind: "ResourceList"},
			Items:    items,
		}
	})

	got, err := lister.List(t.Context(), "stacks-1", "repo-1", ListOptions{})
	require.NoError(t, err)
	require.Equal(t, items, got.Items)
	require.Equal(t, []string{
		"GET /apis/provisioning.grafana.app/v0alpha1/namespaces/stacks-1/repositories/repo-1/resources?limit=1000",
	}, *paths, "a whole-list read bounds its request with the default page size")
}

func TestResourceListerFromProvisioningAPI_ListPage(t *testing.T) {
	lister, paths := serveResources(t, 0, func(*http.Request) (int, any) {
		return http.StatusOK, &provisioning.ResourceList{
			TypeMeta: metav1.TypeMeta{APIVersion: provisioning.APIVERSION, Kind: "ResourceList"},
			ListMeta: metav1.ListMeta{Continue: "next-page"},
			Items:    []provisioning.ResourceListItem{{Path: "dashboard.json", Name: "db-1"}},
		}
	})

	got, err := lister.List(t.Context(), "stacks-1", "repo-1", ListOptions{Limit: 1, Continue: "here"})
	require.NoError(t, err)
	require.Equal(t, "next-page", got.Continue, "the token the caller resumes from must survive")
	require.Equal(t, []string{
		"GET /apis/provisioning.grafana.app/v0alpha1/namespaces/stacks-1/repositories/repo-1/resources?continue=here&limit=1",
	}, *paths)
}

// resourcesURI is the subresource the reader reads, as the test server sees it.
const resourcesURI = "GET /apis/provisioning.grafana.app/v0alpha1/namespaces/stacks-1/repositories/repo-1/resources"

// pagedItems answers the way the route does: at most limit items from after the one the continue
// token names, with a token of its own while more remain. The token is the last item's name here;
// its encoding is the server's business and opaque to the reader.
func pagedItems(items []provisioning.ResourceListItem) func(*http.Request) (int, any) {
	return func(r *http.Request) (int, any) {
		from := 0
		if token := r.URL.Query().Get("continue"); token != "" {
			for i, item := range items {
				if item.Name == token {
					from = i + 1
					break
				}
			}
		}

		page := items[from:]
		list := &provisioning.ResourceList{
			TypeMeta: metav1.TypeMeta{APIVersion: provisioning.APIVERSION, Kind: "ResourceList"},
		}
		if limit, _ := strconv.Atoi(r.URL.Query().Get("limit")); limit > 0 && len(page) > limit {
			page = page[:limit]
			list.Continue = page[len(page)-1].Name
		}
		list.Items = page
		return http.StatusOK, list
	}
}

func testItems(n int) []provisioning.ResourceListItem {
	items := make([]provisioning.ResourceListItem, 0, n)
	for i := range n {
		items = append(items, provisioning.ResourceListItem{
			Path:     fmt.Sprintf("db-%d.json", i),
			Group:    "dashboard.grafana.app",
			Resource: "dashboards",
			Name:     fmt.Sprintf("db-%d", i),
		})
	}
	return items
}

func TestResourceListerFromProvisioningAPI_ListFollowsTheContinueToken(t *testing.T) {
	items := testItems(5)
	lister, paths := serveResources(t, 2, pagedItems(items))

	got, err := lister.List(t.Context(), "stacks-1", "repo-1", ListOptions{})
	require.NoError(t, err)
	require.Equal(t, items, got.Items, "the whole list, in order, once each")
	require.Empty(t, got.Continue, "a whole list leaves nothing to resume from")
	require.Equal(t, []string{
		resourcesURI + "?limit=2",
		resourcesURI + "?continue=db-1&limit=2",
		resourcesURI + "?continue=db-3&limit=2",
	}, *paths)
}

// A caller that asks for a bounded page drives the walk itself and must get that page, not the
// whole list read on its behalf.
func TestResourceListerFromProvisioningAPI_ListHonoursACallerLimit(t *testing.T) {
	items := testItems(5)
	lister, paths := serveResources(t, 2, pagedItems(items))

	got, err := lister.List(t.Context(), "stacks-1", "repo-1", ListOptions{Limit: 3})
	require.NoError(t, err)
	require.Equal(t, items[:3], got.Items)
	require.Equal(t, "db-2", got.Continue)
	require.Equal(t, []string{resourcesURI + "?limit=3"}, *paths)
}

func TestResourceListerFromProvisioningAPI_ListFailsOnANonAdvancingToken(t *testing.T) {
	stuck := func(*http.Request) (int, any) {
		return http.StatusOK, &provisioning.ResourceList{
			TypeMeta: metav1.TypeMeta{APIVersion: provisioning.APIVERSION, Kind: "ResourceList"},
			ListMeta: metav1.ListMeta{Continue: "stuck"},
			Items:    testItems(1),
		}
	}

	t.Run("a token the server repeats", func(t *testing.T) {
		lister, paths := serveResources(t, 2, stuck)

		_, err := lister.List(t.Context(), "stacks-1", "repo-1", ListOptions{})
		require.ErrorContains(t, err, "repeated a continue token")
		require.Len(t, *paths, 2, "the repeat ends the walk instead of reading on")
	})

	t.Run("a token the server echoes back", func(t *testing.T) {
		lister, paths := serveResources(t, 2, stuck)

		_, err := lister.List(t.Context(), "stacks-1", "repo-1", ListOptions{Continue: "stuck"})
		require.ErrorContains(t, err, "repeated a continue token")
		require.Len(t, *paths, 1)
	})
}

// Anything short of the last page is an error: the sync diffs against this list, so a partial read
// returned as a whole one deletes every resource it did not reach.
func TestResourceListerFromProvisioningAPI_ListFailsMidWalk(t *testing.T) {
	items := testItems(5)
	var calls int
	lister, _ := serveResources(t, 2, func(r *http.Request) (int, any) {
		calls++
		if calls > 1 {
			return http.StatusServiceUnavailable, &metav1.Status{
				TypeMeta: statusTypeMeta, Status: metav1.StatusFailure,
				Code: http.StatusServiceUnavailable, Reason: metav1.StatusReasonServiceUnavailable,
			}
		}
		return pagedItems(items)(r)
	})

	got, err := lister.List(t.Context(), "stacks-1", "repo-1", ListOptions{})
	require.True(t, apierrors.IsServiceUnavailable(err), "got %v", err)
	require.Nil(t, got, "a page the reader did get is not a list")
}

func TestResourceListerFromProvisioningAPI_ListWithoutRepository(t *testing.T) {
	lister, paths := serveResources(t, 0, func(*http.Request) (int, any) {
		return http.StatusOK, &provisioning.ResourceList{}
	})

	_, err := lister.List(t.Context(), "stacks-1", "", ListOptions{})
	require.True(t, apierrors.IsBadRequest(err), "got %v", err)
	require.Empty(t, *paths, "a name the route requires must not be sent as an empty path segment")
}

// The route's callers translate what the lister returns through StatusErrorFromGRPC, which is
// written for the gRPC reader. An already-typed status has to come out the other side unchanged.
// statusTypeMeta is what an apiserver stamps on an error body; without it the client cannot tell
// the body is a Status and falls back to a message of its own.
var statusTypeMeta = metav1.TypeMeta{Kind: "Status", APIVersion: "v1"}

func TestResourceListerFromProvisioningAPI_ListErrorsSurviveTranslation(t *testing.T) {
	for _, tc := range []struct {
		name   string
		status *metav1.Status
		assert func(error) bool
	}{
		{"not found", &metav1.Status{TypeMeta: statusTypeMeta, Status: metav1.StatusFailure, Code: http.StatusNotFound, Reason: metav1.StatusReasonNotFound, Message: `repositories "repo-1" not found`}, apierrors.IsNotFound},
		{"forbidden", &metav1.Status{TypeMeta: statusTypeMeta, Status: metav1.StatusFailure, Code: http.StatusForbidden, Reason: metav1.StatusReasonForbidden, Message: "no access"}, apierrors.IsForbidden},
		{"unavailable", &metav1.Status{TypeMeta: statusTypeMeta, Status: metav1.StatusFailure, Code: http.StatusServiceUnavailable, Reason: metav1.StatusReasonServiceUnavailable, Message: "try later"}, apierrors.IsServiceUnavailable},
	} {
		t.Run(tc.name, func(t *testing.T) {
			lister, _ := serveResources(t, 0, func(*http.Request) (int, any) {
				return int(tc.status.Code), tc.status
			})

			_, err := lister.List(t.Context(), "stacks-1", "repo-1", ListOptions{})
			require.True(t, tc.assert(err), "reader returned %v", err)

			translated := resource.StatusErrorFromGRPC(err)
			require.True(t, tc.assert(translated), "translation returned %v", translated)
			require.Equal(t, tc.status.Message, translated.(apierrors.APIStatus).Status().Message)
		})
	}
}

func TestResourceListerFromProvisioningAPI_RepositoryStats(t *testing.T) {
	counts := []provisioning.ResourceCount{
		{Group: "dashboard.grafana.app", Resource: "dashboards", Count: 2},
		{Group: "folder.grafana.app", Resource: "folders", Count: 1},
	}
	lister, paths := serveResources(t, 0, func(*http.Request) (int, any) {
		return http.StatusOK, &provisioning.ResourceCountList{
			TypeMeta: metav1.TypeMeta{APIVersion: provisioning.APIVERSION, Kind: "ResourceCountList"},
			Items:    counts,
		}
	})

	got, err := lister.RepositoryStats(t.Context(), "stacks-1", "repo-1")
	require.NoError(t, err)
	require.Equal(t, counts, got)
	require.Equal(t, []string{"GET /apis/provisioning.grafana.app/v0alpha1/namespaces/stacks-1/repositories/repo-1/stats"}, *paths)
}

func TestResourceListerFromProvisioningAPI_RepositoryStatsWithoutRepository(t *testing.T) {
	lister, paths := serveResources(t, 0, func(*http.Request) (int, any) {
		return http.StatusOK, &provisioning.ResourceCountList{}
	})

	_, err := lister.RepositoryStats(t.Context(), "stacks-1", "")
	require.True(t, apierrors.IsBadRequest(err), "got %v", err)
	require.Empty(t, *paths, "a name the route requires must not be sent as an empty path segment")
}

// A repository the index counts nothing for is a 404, which the caller must not read as a
// successful count of zero.
func TestResourceListerFromProvisioningAPI_RepositoryStatsNotFound(t *testing.T) {
	lister, _ := serveResources(t, 0, func(*http.Request) (int, any) {
		return http.StatusNotFound, &metav1.Status{
			TypeMeta: statusTypeMeta,
			Status:   metav1.StatusFailure,
			Code:     http.StatusNotFound,
			Reason:   metav1.StatusReasonNotFound,
			Message:  `stats.provisioning.grafana.app "repo-1" not found`,
		}
	})

	_, err := lister.RepositoryStats(t.Context(), "stacks-1", "repo-1")
	require.True(t, apierrors.IsNotFound(err), "got %v", err)
	require.True(t, apierrors.IsNotFound(resource.StatusErrorFromGRPC(err)), "got %v", err)
}

// The namespace-wide counts are a different route, not this subresource with an empty name.
