package v1

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

func TestManagedRoutes_Sort(t *testing.T) {
	routes := ManagedRoutes{
		{Name: "x"},
		{Name: models.DefaultRoutingTreeName},
		{Name: "z"},
	}

	routes.Sort()

	assert.Equal(t, "x", routes[0].Name)
	assert.Equal(t, "z", routes[1].Name)
	assert.Equal(t, models.DefaultRoutingTreeName, routes[2].Name)
}

func TestManagedRoutes_Contains(t *testing.T) {
	routes := ManagedRoutes{
		{Name: "x"},
		{Name: models.DefaultRoutingTreeName},
		{Name: "z"},
	}
	assert.True(t, routes.Contains("x"))
	assert.True(t, routes.Contains("z"))
	assert.True(t, routes.Contains(models.DefaultRoutingTreeName))
	assert.False(t, routes.Contains("missing"))
}
