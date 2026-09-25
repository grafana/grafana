package dashboards

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	dashboardV2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	searchV0 "github.com/grafana/grafana/pkg/apis/search/v0alpha1"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// Notebooks declare no searchFields of their own, so everything here runs on the
// standard field set the index gives every kind. The point of the test is that a
// kind reaches the search endpoint purely by being listed in searchroutes.allowed —
// no document builder, no manifest declaration.
//
// Helpers (search, names, postRaw) are shared with searchapi_test.go.
func TestIntegrationNotebooksSearchAPI(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	ctx := context.Background()

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction:    true,
		DisableAnonymous:     true,
		APIServerStorageType: "unified",
		EnableSearchAPI:      true,
		// The notebooks authorizer denies every resource request when the flag is
		// off, so without this the endpoint 403s before it reaches search.
		EnableFeatureToggles: []string{featuremgmt.FlagDashboardNotebooks},
	})
	defer helper.Shutdown()

	gvr := schema.GroupVersionResource{
		Group:    dashboardV2beta1.GROUP,
		Version:  dashboardV2beta1.VERSION,
		Resource: "notebooks",
	}
	admin := helper.GetResourceClient(apis.ResourceClientArgs{User: helper.Org1.Admin, GVR: gvr})

	// Three titles share a word so a text query selects them as a set; the fourth
	// does not, so "narrows" means something.
	matching := map[string]string{
		"nbsearch-cpu":    "CPU saturation investigation",
		"nbsearch-memory": "Memory saturation investigation",
		"nbsearch-disk":   "Disk saturation investigation",
	}
	const unrelatedName = "nbsearch-unrelated"

	created := map[string]*unstructured.Unstructured{}
	for name, title := range matching {
		created[name] = createNotebook(t, ctx, admin, gvr, name, title)
	}
	created[unrelatedName] = createNotebook(t, ctx, admin, gvr, unrelatedName, "Quarterly capacity review")

	t.Run("finds notebooks by title and leaves non-matches out", func(t *testing.T) {
		results, code := search(t, ctx, helper.Org1.Admin, gvr, searchV0.SearchQuery{
			Where: &searchV0.WhereNode{
				Text: &searchV0.TextPredicate{Value: "saturation"},
			},
			Limit: 10,
		})
		require.Equal(t, http.StatusOK, code)

		got := names(results)
		assert.Subset(t, got, []string{"nbsearch-cpu", "nbsearch-memory", "nbsearch-disk"})
		assert.NotContains(t, got, unrelatedName, "a notebook whose title lacks the term should not match")
	})

	t.Run("returns the search envelope", func(t *testing.T) {
		results, code := search(t, ctx, helper.Org1.Admin, gvr, searchV0.SearchQuery{
			Where: &searchV0.WhereNode{
				Text: &searchV0.TextPredicate{Value: "saturation"},
			},
			Fields: []string{"title"},
			Limit:  10,
		})
		require.Equal(t, http.StatusOK, code)
		require.NotEmpty(t, results.Items)

		item := results.Items[0]
		assert.Equal(t, gvr.Group, item.Resource.Group)
		assert.Equal(t, "notebooks", item.Resource.Resource)
		assert.Equal(t, "Notebook", item.Resource.Kind)
		assert.NotEmpty(t, item.Resource.Name)

		// Ranked by a text query, so every item carries a score.
		require.NotNil(t, item.Score, "a text query should produce a score")
	})

	// The projection is the reason a list page would use search rather than LIST:
	// LIST has no way to ask for less than the whole spec.
	t.Run("returns only the requested fields", func(t *testing.T) {
		results, code := search(t, ctx, helper.Org1.Admin, gvr, searchV0.SearchQuery{
			Where: &searchV0.WhereNode{
				Text: &searchV0.TextPredicate{Value: "saturation"},
			},
			Fields: []string{"title"},
			Limit:  10,
		})
		require.Equal(t, http.StatusOK, code)
		require.NotEmpty(t, results.Items)

		fields := results.Items[0].Fields
		require.NotNil(t, fields)
		assert.Contains(t, fields.Object, "title")
		assert.NotContains(t, fields.Object, "createdBy", "createdBy was not requested")
		assert.NotContains(t, fields.Object, "created", "created was not requested")
	})

	t.Run("filters by createdBy", func(t *testing.T) {
		// Read the identity key off a created notebook rather than reconstructing
		// it, so the test cannot disagree with whatever format storage wrote.
		createdBy := created["nbsearch-cpu"].GetAnnotations()[utils.AnnoKeyCreatedBy]
		require.NotEmpty(t, createdBy, "notebooks should record who created them")

		results, code := search(t, ctx, helper.Org1.Admin, gvr, searchV0.SearchQuery{
			Where: &searchV0.WhereNode{
				Filter: &searchV0.FilterPredicate{
					Field:    "createdBy",
					Operator: "In",
					Values:   []string{createdBy},
				},
			},
			Fields: []string{"title", "createdBy"},
			Limit:  50,
		})
		require.Equal(t, http.StatusOK, code)
		require.NotEmpty(t, results.Items)
		assert.Subset(t, names(results), []string{"nbsearch-cpu", "nbsearch-memory", "nbsearch-disk"})

		for _, item := range results.Items {
			require.NotNil(t, item.Fields)
			assert.Equal(t, createdBy, item.Fields.Object["createdBy"])
		}

		// A filter nobody matches returns an empty set rather than everything.
		empty, code := search(t, ctx, helper.Org1.Admin, gvr, searchV0.SearchQuery{
			Where: &searchV0.WhereNode{
				Filter: &searchV0.FilterPredicate{
					Field:    "createdBy",
					Operator: "In",
					Values:   []string{"user:nobody-created-anything"},
				},
			},
			Limit: 50,
		})
		require.Equal(t, http.StatusOK, code)
		assert.Empty(t, empty.Items)
	})

	t.Run("pages with the continue token", func(t *testing.T) {
		query := searchV0.SearchQuery{
			Where: &searchV0.WhereNode{
				Text: &searchV0.TextPredicate{Value: "saturation"},
			},
			Limit: 1,
		}

		seen := map[string]bool{}
		for page := 0; page < len(matching)+1; page++ {
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

		for name := range matching {
			assert.True(t, seen[name], "%s never appeared across pages", name)
		}
	})

	// title is the one standard field carrying the sort capability, so it is what a
	// caller paging through notebooks has to order by today.
	t.Run("sorts by title", func(t *testing.T) {
		results, code := search(t, ctx, helper.Org1.Admin, gvr, searchV0.SearchQuery{
			Where: &searchV0.WhereNode{
				Text: &searchV0.TextPredicate{Value: "saturation"},
			},
			Sort:   []searchV0.SortField{{Field: "title", Direction: "asc"}},
			Fields: []string{"title"},
			Limit:  10,
		})
		require.Equal(t, http.StatusOK, code)
		require.Len(t, results.Items, len(matching))

		assert.Equal(t, []string{"nbsearch-cpu", "nbsearch-disk", "nbsearch-memory"}, names(results),
			"CPU < Disk < Memory by title")
	})

	// created and updated are declared retrieve-only in StandardSearchFieldDefinitions,
	// so asking to sort on them is rejected rather than silently ignored. A list page
	// wanting "most recently updated first" is blocked on that capability, not on
	// anything notebooks-specific — this pins the contract so a change there is
	// deliberate.
	t.Run("rejects sorting on a retrieve-only field", func(t *testing.T) {
		for _, f := range []string{"updated", "created"} {
			_, code := search(t, ctx, helper.Org1.Admin, gvr, searchV0.SearchQuery{
				Sort:  []searchV0.SortField{{Field: f}},
				Limit: 10,
			})
			assert.Equal(t, http.StatusUnprocessableEntity, code, "sorting on %q should be rejected", f)
		}
	})

	t.Run("rejects a field the kind does not declare", func(t *testing.T) {
		_, code := search(t, ctx, helper.Org1.Admin, gvr, searchV0.SearchQuery{
			Sort:  []searchV0.SortField{{Field: "not-a-field"}},
			Limit: 10,
		})
		assert.Equal(t, http.StatusUnprocessableEntity, code)
	})
}

// The search route is mounted from searchroutes.allowed, which knows nothing about
// FlagDashboardNotebooks — so the path exists whenever enable_search_api is on. What
// gates it is newNotebookAuthorizer, which denies every notebooks resource request
// while the flag is off. A search POST parses as a create on resource "notebooks"
// (name "search"), so it dispatches to that authorizer like any other verb.
//
// This asserts the gate holds for search specifically: the endpoint being reachable
// must not become a way around the feature flag.
func TestIntegrationNotebooksSearchRequiresFeatureFlag(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	ctx := context.Background()

	// Same setup as the test above, minus FlagDashboardNotebooks.
	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction:    true,
		DisableAnonymous:     true,
		APIServerStorageType: "unified",
		EnableSearchAPI:      true,
	})
	defer helper.Shutdown()

	gvr := schema.GroupVersionResource{
		Group:    dashboardV2beta1.GROUP,
		Version:  dashboardV2beta1.VERSION,
		Resource: "notebooks",
	}

	t.Run("search is denied while the feature is off", func(t *testing.T) {
		_, code := search(t, ctx, helper.Org1.Admin, gvr, searchV0.SearchQuery{
			Where: &searchV0.WhereNode{
				Text: &searchV0.TextPredicate{Value: "saturation"},
			},
			Limit: 10,
		})
		// Denied even for an admin: the gate is the feature, not permissions.
		assert.Equal(t, http.StatusForbidden, code)
	})

	// The comparison that makes the assertion above meaningful: with the flag off
	// every notebooks verb is denied, so search is not a special case being missed.
	t.Run("list is denied the same way", func(t *testing.T) {
		client := helper.GetResourceClient(apis.ResourceClientArgs{User: helper.Org1.Admin, GVR: gvr})
		_, err := client.Resource.List(ctx, metav1.ListOptions{})
		require.Error(t, err)
		assert.True(t, apierrors.IsForbidden(err), "expected Forbidden, got %v", err)
	})
}

// createNotebook writes the smallest notebook the admission chain accepts: a
// title, no elements, and a NotebookLayout (validateNotebook rejects any other
// layout kind).
func createNotebook(
	t *testing.T,
	ctx context.Context,
	client *apis.K8sResourceClient,
	gvr schema.GroupVersionResource,
	name, title string,
) *unstructured.Unstructured {
	t.Helper()

	obj := &unstructured.Unstructured{Object: map[string]any{
		"spec": map[string]any{
			"title":    title,
			"elements": map[string]any{},
			"layout": map[string]any{
				"kind": "NotebookLayout",
				"spec": map[string]any{"cells": []any{}},
			},
		},
	}}
	obj.SetName(name)
	obj.SetAPIVersion(gvr.GroupVersion().String())
	obj.SetKind("Notebook")

	out, err := client.Resource.Create(ctx, obj, metav1.CreateOptions{})
	require.NoError(t, err)
	return out
}
