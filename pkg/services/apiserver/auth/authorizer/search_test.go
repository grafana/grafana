package authorizer

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/util/sets"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/endpoints/request"
)

// Uses the apiserver's own parser, so the assumptions below are pinned to real
// behaviour rather than a guess.
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
	base       = "/apis/dashboard.grafana.app/v0alpha1/namespaces/default/dashboards"
	searchPath = base + "/search"
	trashPath  = base + "/trash"
	listPath   = base
)

func TestIsSearchRequest(t *testing.T) {
	for _, path := range []string{searchPath, trashPath} {
		attr := attributesFor(t, http.MethodPost, path)
		require.Equal(t, "create", attr.GetVerb())
		require.Equal(t, "dashboards", attr.GetResource())
		assert.True(t, IsSearchRequest(attr), "path %s", path)
	}

	// Creating a dashboard posts to the collection, so it carries no name and
	// must not be mistaken for a search.
	createAttr := attributesFor(t, http.MethodPost, listPath)
	require.Empty(t, createAttr.GetName())
	assert.False(t, IsSearchRequest(createAttr))

	assert.False(t, IsSearchRequest(attributesFor(t, http.MethodGet, listPath)))

	// An object may legitimately be named "search" or "trash", and is only ever
	// reached with a non-create verb.
	for _, path := range []string{searchPath, trashPath} {
		assert.False(t, IsSearchRequest(attributesFor(t, http.MethodGet, path)), "path %s", path)
		assert.False(t, IsSearchRequest(attributesFor(t, http.MethodPut, path)), "path %s", path)
		assert.False(t, IsSearchRequest(attributesFor(t, http.MethodDelete, path)), "path %s", path)
	}

	// A subresource named "search" is a different endpoint and not ours.
	sub := attributesFor(t, http.MethodPost, base+"/my-dash/search")
	require.Equal(t, "search", sub.GetSubresource())
	assert.False(t, IsSearchRequest(sub))
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

// The org role authorizer allows a viewer to list but not to create, which is why
// the restatement has to happen before the chain.
func TestGrafanaAuthorizer_ViewerMaySearchButNotCreate(t *testing.T) {
	var seen []string
	recorder := authorizer.AuthorizerFunc(
		func(_ context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
			seen = append(seen, attr.GetVerb())
			return authorizer.DecisionNoOpinion, "", nil
		})

	a := &GrafanaAuthorizer{auth: recorder}

	_, _, err := a.Authorize(context.Background(), attributesFor(t, http.MethodPost, searchPath))
	require.NoError(t, err)
	_, _, err = a.Authorize(context.Background(), attributesFor(t, http.MethodPost, trashPath))
	require.NoError(t, err)
	_, _, err = a.Authorize(context.Background(), attributesFor(t, http.MethodPost, listPath))
	require.NoError(t, err)

	assert.Equal(t, []string{"list", "list", "create"}, seen)
}
