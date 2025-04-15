package kinds

import (
	"github.com/grafana/grafana/apps/alerting/notifications/kinds/v0alpha1"
)

routeTree: {
	kind: "RoutingTree"
	apiResource: {
		groupOverride: "notifications.alerting.grafana.app"
	}
	pluralName: "RoutingTrees"
	current:    "v0alpha1"
	codegen: {
		ts: {enabled: false}
		go: {enabled: true}
	}
	versions: {
		"v0alpha1": {
			schema: {
				spec: v0alpha1.RouteTreeSpec
			}
		}
	}
}
