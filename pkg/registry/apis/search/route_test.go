package search

import (
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/util/sets"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/endpoints/request"
)

// attributesFor runs a path through the same parser the apiserver uses, so the
// assumptions below are pinned to real behaviour rather than a guess.
func attributesFor(t *testing.T, method, path string) authorizer.Attributes {
	t.Helper()
	f := &request.RequestInfoFactory{
		APIPrefixes:          sets.NewString("apis"),
		GrouplessAPIPrefixes: sets.NewString(),
	}
	r, err := http.NewRequest(method, path, nil)
	require.NoError(t, err)
	info, err := f.NewRequestInfo(r)
	require.NoError(t, err)

	return authorizer.AttributesRecord{
		Verb:            info.Verb,
		Namespace:       info.Namespace,
		APIGroup:        info.APIGroup,
		APIVersion:      info.APIVersion,
		Resource:        info.Resource,
		Subresource:     info.Subresource,
		Name:            info.Name,
		ResourceRequest: info.IsResourceRequest,
		Path:            path,
	}
}

const (
	searchPath = "/apis/dashboard.grafana.app/v0alpha1/namespaces/default/dashboards/search"
	listPath   = "/apis/dashboard.grafana.app/v0alpha1/namespaces/default/dashboards"
)

func TestIsSearchRequest(t *testing.T) {
	// The endpoint is a POST so it can carry a body, which the apiserver parses
	// as a create on the kind named "search".
	searchAttr := attributesFor(t, http.MethodPost, searchPath)
	require.Equal(t, "create", searchAttr.GetVerb())
	require.Equal(t, "dashboards", searchAttr.GetResource())
	require.Equal(t, searchPathSegment, searchAttr.GetName())
	assert.True(t, IsSearchRequest(searchAttr))

	// Creating a dashboard posts to the collection, so it carries no name and
	// must not be mistaken for a search.
	createAttr := attributesFor(t, http.MethodPost, listPath)
	require.Empty(t, createAttr.GetName())
	assert.False(t, IsSearchRequest(createAttr))

	// Reads of the collection are untouched.
	assert.False(t, IsSearchRequest(attributesFor(t, http.MethodGet, listPath)))

	// A dashboard that happens to be named "search" is only ever reached with a
	// non-create verb, so it stays a normal object operation.
	assert.False(t, IsSearchRequest(attributesFor(t, http.MethodGet, searchPath)))
	assert.False(t, IsSearchRequest(attributesFor(t, http.MethodDelete, searchPath)))
}

func TestAsReadAttributes(t *testing.T) {
	read := AsReadAttributes(attributesFor(t, http.MethodPost, searchPath))

	// Searching reads the kind, so it must not demand permission to create it.
	assert.Equal(t, "list", read.GetVerb())
	assert.True(t, read.IsReadOnly())
	// "search" was a path segment, not an object.
	assert.Empty(t, read.GetName())

	// Everything the authorizer scopes on is preserved.
	assert.Equal(t, "dashboard.grafana.app", read.GetAPIGroup())
	assert.Equal(t, "v0alpha1", read.GetAPIVersion())
	assert.Equal(t, "dashboards", read.GetResource())
	assert.Equal(t, "default", read.GetNamespace())
	assert.True(t, read.IsResourceRequest())
}

func TestSearchOperationID(t *testing.T) {
	versions := []string{"v0alpha1", "v1", "v1beta1", "v2alpha1", "v2beta1"}

	// The endpoint is mounted on every served version, so the IDs have to stay
	// distinct once the per-version specs are merged.
	seen := map[string]bool{}
	for _, v := range versions {
		id := searchOperationID("Dashboard", v)
		require.False(t, seen[id], "duplicate operation ID %q", id)
		seen[id] = true

		// Starting with a Kubernetes verb stops the route builder prefixing
		// "create" onto what is really a read.
		assert.True(t, strings.HasPrefix(id, "list"), "got %q", id)
	}

	assert.Equal(t, "listDashboardSearchV0alpha1", searchOperationID("Dashboard", "v0alpha1"))
}
