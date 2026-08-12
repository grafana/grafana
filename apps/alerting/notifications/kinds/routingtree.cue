package kinds

import (
	"github.com/grafana/grafana/apps/alerting/notifications/kinds/v0alpha1"
	"github.com/grafana/grafana/apps/alerting/notifications/kinds/v1beta1"
)

routingTreeKind: {
	kind:       "RoutingTree"
	pluralName: "RoutingTrees"
}

routeTreev0alpha1: routingTreeKind & {
	schema: {
		spec: v0alpha1.RouteTreeSpec
	}
}

routeTreev1beta1: routingTreeKind & {
	schema: {
		spec: v1beta1.RouteTreeSpec
	}
}
