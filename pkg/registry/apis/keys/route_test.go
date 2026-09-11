package keys

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"
	"k8s.io/apimachinery/pkg/util/sets"
	"k8s.io/apiserver/pkg/endpoints/request"
)

func testRoute(t *testing.T) Route {
	t.Helper()
	h := NewHandler(&fakeStore{}, noop.NewTracerProvider().Tracer("test"))
	return h.ListKeysRoute(testGroup, testVersion, testResource, testKind)
}

func TestListKeysRoute_Shape(t *testing.T) {
	r := testRoute(t)

	assert.Equal(t, "dashboards/list-keys", r.Path)
	require.NotNil(t, r.Handler)

	require.NotNil(t, r.Spec)
	require.NotNil(t, r.Spec.Post, "the endpoint is a POST")
	assert.Nil(t, r.Spec.Get)
	assert.Nil(t, r.Spec.Put)
	assert.Nil(t, r.Spec.Patch)
	assert.Nil(t, r.Spec.Delete)

	op := r.Spec.Post.OperationProps
	assert.Equal(t, "listDashboardKeysV1beta1", op.OperationId)
	// Cluster-scoped: no namespace in the path to describe.
	assert.Empty(t, op.Parameters)

	// Accepted but not required: every field has a default.
	require.NotNil(t, op.RequestBody)
	assert.False(t, op.RequestBody.Required)
	assert.Contains(t, op.RequestBody.Content, "application/json")

	require.NotNil(t, op.Responses)
	ok := op.Responses.StatusCodeResponses[200]
	require.NotNil(t, ok)
	assert.Contains(t, ok.Content, "application/json")
}

// Each group version's document is self-contained, so referenced components have
// to travel with the route. A missing one renders as an empty model with no error.
func TestListKeysRoute_PublishesReferencedSchemas(t *testing.T) {
	r := testRoute(t)
	require.NotEmpty(t, r.Schemas)

	for _, want := range []string{
		"io.k8s.apimachinery.pkg.apis.meta.v1.ListOptions",
		"io.k8s.apimachinery.pkg.apis.meta.v1.PartialObjectMetadataList",
		// Reached transitively.
		"io.k8s.apimachinery.pkg.apis.meta.v1.PartialObjectMetadata",
		"io.k8s.apimachinery.pkg.apis.meta.v1.ObjectMeta",
		"io.k8s.apimachinery.pkg.apis.meta.v1.ListMeta",
	} {
		assert.Contains(t, r.Schemas, want)
	}

	// Every $ref the spec emits must be one of the published components.
	bodyRef := r.Spec.Post.RequestBody.Content["application/json"].Schema.Ref.String()
	respRef := r.Spec.Post.Responses.StatusCodeResponses[200].Content["application/json"].Schema.Ref.String()
	for _, ref := range []string{bodyRef, respRef} {
		require.True(t, len(ref) > len(componentPrefix), "unexpected ref %q", ref)
		assert.Contains(t, r.Schemas, ref[len(componentPrefix):])
	}
}

// Pins how the apiserver parses the path: a create on an object named
// "list-keys", which the authorizer restates as a list.
func TestListKeysRoute_ParsesAsClusterScopedNamedCreate(t *testing.T) {
	f := &request.RequestInfoFactory{
		APIPrefixes:          sets.NewString("apis"),
		GrouplessAPIPrefixes: sets.NewString(),
	}
	path := "/apis/" + testGroup + "/" + testVersion + "/" + testRoute(t).Path

	req, err := http.NewRequest(http.MethodPost, path, nil)
	require.NoError(t, err)
	info, err := f.NewRequestInfo(req)
	require.NoError(t, err)

	assert.Equal(t, "create", info.Verb)
	assert.Equal(t, testResource, info.Resource)
	assert.Equal(t, "list-keys", info.Name)
	assert.Empty(t, info.Namespace, "cluster-scoped: no namespace in the path")
	assert.Empty(t, info.Subresource, "a subresource would be a different endpoint")
}
