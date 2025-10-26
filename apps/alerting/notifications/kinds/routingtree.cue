package kinds

import (
	"github.com/grafana/grafana/apps/alerting/notifications/kinds/v0alpha1"
)
routingTreeKind: {
	kind: "RoutingTree"
	pluralName: "RoutingTrees"
}

routeTreev0alpha1: routingTreeKind & {
	schema: {
		spec: v0alpha1.RouteTreeSpec
	}
}
