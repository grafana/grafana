package legacy_storage

import (
	"testing"

	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	v1 "github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage/v1"
)

func TestManagedRouteToRoute(t *testing.T) {
	gw := model.Duration(10)
	gi := model.Duration(20)
	ri := model.Duration(30)

	mr := &ManagedRoute{
		Name:           "test",
		Receiver:       "receiver",
		GroupBy:        []string{"alertname"},
		GroupWait:      &gw,
		GroupInterval:  &gi,
		RepeatInterval: &ri,
		Routes:         []*v1.Route{{Receiver: "child"}},
		Provenance:     models.Provenance("test"),
	}

	route := ManagedRouteToRoute(mr)

	assert.Equal(t, "receiver", route.Receiver)
	assert.Equal(t, []string{"alertname"}, route.GroupByStr)
	assert.Equal(t, &gw, route.GroupWait)
	assert.Equal(t, &gi, route.GroupInterval)
	assert.Equal(t, &ri, route.RepeatInterval)
	assert.Len(t, route.Routes, 1)
	assert.EqualValues(t, v1.Provenance("test"), route.Provenance)
}
