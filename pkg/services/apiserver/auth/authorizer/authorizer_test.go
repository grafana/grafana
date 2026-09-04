package authorizer

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/authorization/authorizer"
)

// Keys is cluster-scoped, so its path carries no namespace.
const listKeysPath = "/apis/dashboard.grafana.app/v0alpha1/dashboards/list-keys"

func TestIsListKeysRequest(t *testing.T) {
	post := attributesFor(t, http.MethodPost, listKeysPath)
	require.Equal(t, "create", post.GetVerb())
	require.Equal(t, "dashboards", post.GetResource())
	require.Equal(t, ListKeysPathSegment, post.GetName())
	assert.True(t, IsListKeysRequest(post))

	// Creating a dashboard posts to the collection, so it carries no name and
	// must not be mistaken for a keys list.
	create := attributesFor(t, http.MethodPost, "/apis/dashboard.grafana.app/v0alpha1/dashboards")
	require.Empty(t, create.GetName())
	assert.False(t, IsListKeysRequest(create))

	// An object may legitimately carry the name, and is only ever reached with a
	// non-create verb.
	for _, method := range []string{http.MethodGet, http.MethodPut, http.MethodDelete} {
		assert.False(t, IsListKeysRequest(attributesFor(t, method, listKeysPath)), "method %s", method)
	}

	// A subresource named list-keys is a different endpoint and not ours.
	sub := attributesFor(t, http.MethodPost, base+"/my-dash/list-keys")
	require.Equal(t, "list-keys", sub.GetSubresource())
	assert.False(t, IsListKeysRequest(sub))

	// Search and trash are handled by IsSearchRequest, not this one.
	assert.False(t, IsListKeysRequest(attributesFor(t, http.MethodPost, searchPath)))
	assert.False(t, IsListKeysRequest(attributesFor(t, http.MethodPost, trashPath)))
}

func TestAsReadAttributes_ListKeys(t *testing.T) {
	read := AsReadAttributes(attributesFor(t, http.MethodPost, listKeysPath))

	// Listing keys reads the kind, so it must not demand permission to create it.
	assert.Equal(t, "list", read.GetVerb())
	assert.True(t, read.IsReadOnly())
	// "list-keys" was a path segment, not an object.
	assert.Empty(t, read.GetName())

	assert.Equal(t, "dashboard.grafana.app", read.GetAPIGroup())
	assert.Equal(t, "v0alpha1", read.GetAPIVersion())
	assert.Equal(t, "dashboards", read.GetResource())
	// Cluster-scoped, so there is no namespace to carry.
	assert.Empty(t, read.GetNamespace())
	assert.True(t, read.IsResourceRequest())
}

// The org role authorizer allows a viewer to list but not to create, which is why
// the restatement has to happen before the chain.
func TestGrafanaAuthorizer_ViewerMayListKeysButNotCreate(t *testing.T) {
	var seen []string
	recorder := authorizer.AuthorizerFunc(
		func(_ context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
			seen = append(seen, attr.GetVerb())
			return authorizer.DecisionNoOpinion, "", nil
		})

	a := &GrafanaAuthorizer{auth: recorder}

	_, _, err := a.Authorize(context.Background(), attributesFor(t, http.MethodPost, listKeysPath))
	require.NoError(t, err)
	_, _, err = a.Authorize(context.Background(), attributesFor(t, http.MethodPost, listPath))
	require.NoError(t, err)

	assert.Equal(t, []string{"list", "create"}, seen)
}
