package search

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"
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
