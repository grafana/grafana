package v1

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

func TestManagedRoutes_Sort(t *testing.T) {
	routes := ManagedRoutes{
		{ResourceMetadata: ResourceMetadata{UID: "x"}},
		{ResourceMetadata: ResourceMetadata{UID: models.DefaultRoutingTreeName}},
		{ResourceMetadata: ResourceMetadata{UID: "z"}},
	}

	routes.Sort()

	assert.Equal(t, "x", routes[0].GetUID())
	assert.Equal(t, "z", routes[1].GetUID())
	assert.Equal(t, models.DefaultRoutingTreeName, routes[2].GetUID())
}

func TestManagedRoutes_Contains(t *testing.T) {
	routes := ManagedRoutes{
		{ResourceMetadata: ResourceMetadata{UID: "x"}},
		{ResourceMetadata: ResourceMetadata{UID: models.DefaultRoutingTreeName}},
		{ResourceMetadata: ResourceMetadata{UID: "z"}},
	}
	assert.True(t, routes.Contains("x"))
	assert.True(t, routes.Contains("z"))
	assert.True(t, routes.Contains(models.DefaultRoutingTreeName))
	assert.False(t, routes.Contains("missing"))
}

func TestRouteUID(t *testing.T) {
	assert.Equal(t, ResourceUID("my-route"), RouteUID("my-route"))

	// The default tree's legacy alias must canonicalize to the same identity as its canonical name,
	// since both back the same RBAC scope and provenance-store key.
	assert.Equal(t, ResourceUID(models.DefaultRoutingTreeName), RouteUID(models.DefaultRoutingTreeNameAlias))
	assert.Equal(t, ResourceUID(models.DefaultRoutingTreeName), RouteUID(models.DefaultRoutingTreeName))
}

func TestNewManagedRoute_UID(t *testing.T) {
	route := &Route{Receiver: "receiver"}

	mr := NewManagedRoute("my-route", route)
	assert.Equal(t, "my-route", mr.GetUID())

	for _, name := range []string{models.DefaultRoutingTreeName, models.DefaultRoutingTreeNameAlias} {
		mr := NewManagedRoute(name, route)
		// GetUID() always resolves to the canonical identity, regardless of which spelling was requested.
		assert.Equal(t, models.DefaultRoutingTreeName, mr.GetUID())
	}
}
