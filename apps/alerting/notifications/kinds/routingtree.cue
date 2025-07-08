package kinds

import (
	"github.com/grafana/grafana/apps/alerting/notifications/kinds/v0alpha1"
)

routeTreev0alpha1: {
	kind:   "RoutingTree"
	plural: "routingtrees"
	scope:  "Namespaced"
	schema: {
		spec: v0alpha1.RouteTreeSpec
	}
}
