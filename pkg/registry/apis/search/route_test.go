package search

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"
	"k8s.io/kube-openapi/pkg/validation/spec"
)

func TestSearchRoute(t *testing.T) {
	h := NewHandler(&fakeIndexClient{resp: emptyResponse()}, testProvider(), noop.NewTracerProvider().Tracer(""))
	r := h.SearchRoute("dashboard.grafana.app", "v0alpha1", "dashboards", "Dashboard")

	// Relative to the group-version root the caller mounts under, so the served
	// path ends up .../namespaces/{namespace}/dashboards/search.
	assert.Equal(t, "dashboards/search", r.Path)
	require.NotNil(t, r.Handler)

	require.NotNil(t, r.Spec)
	require.NotNil(t, r.Spec.Post, "search is a POST, so no other method should be described")
	assert.Nil(t, r.Spec.Get)
	assert.Equal(t, "listDashboardSearchV0alpha1", r.Spec.Post.OperationId)
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

// An unresolved $ref renders as an empty model rather than erroring, so every
// reference in the published set has to resolve within it.
func TestSearchRoute_EveryRefResolves(t *testing.T) {
	r := NewHandler(&fakeIndexClient{resp: emptyResponse()}, testProvider(), noop.NewTracerProvider().Tracer("")).
		SearchRoute("dashboard.grafana.app", "v1", "dashboards", "Dashboard")

	require.NotEmpty(t, r.Schemas, "the route must publish the components it references")

	const pkg = "com.github.grafana.grafana.pkg.apis.search.v0alpha1."
	reqRef := r.Spec.Post.RequestBody.Content["application/json"].Schema.Ref.String()
	resRef := r.Spec.Post.Responses.StatusCodeResponses[200].Content["application/json"].Schema.Ref.String()
	assert.Equal(t, "#/components/schemas/"+pkg+"SearchQuery", reqRef)
	assert.Equal(t, "#/components/schemas/"+pkg+"SearchResults", resRef)
	assert.Contains(t, r.Schemas, pkg+"SearchQuery")
	assert.Contains(t, r.Schemas, pkg+"SearchResults")

	// Reached only through WhereNode, which contains itself: the walk followed
	// dependencies and still terminated.
	assert.Contains(t, r.Schemas, pkg+"WhereNode")
	assert.Contains(t, r.Schemas, pkg+"TextPredicate")

	// Trash belongs to an endpoint that does not exist yet.
	assert.NotContains(t, r.Schemas, pkg+"TrashQuery")

	// Nothing anywhere in the published set points outside it.
	for name, schema := range r.Schemas {
		for _, ref := range collectRefs(&schema) {
			assert.Contains(t, r.Schemas, ref, "%s references %s, which is not published", name, ref)
		}
	}
}

// collectRefs returns the component names a schema references.
func collectRefs(s *spec.Schema) []string {
	if s == nil {
		return nil
	}
	var out []string
	if ref := s.Ref.String(); strings.HasPrefix(ref, "#/components/schemas/") {
		out = append(out, strings.TrimPrefix(ref, "#/components/schemas/"))
	}
	for _, p := range s.Properties {
		out = append(out, collectRefs(&p)...)
	}
	if s.Items != nil {
		out = append(out, collectRefs(s.Items.Schema)...)
	}
	if s.AdditionalProperties != nil {
		out = append(out, collectRefs(s.AdditionalProperties.Schema)...)
	}
	return out
}
