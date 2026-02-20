package kinds

manifest: {
	appName: "stalebot"
	groupOverride: "stalebot.grafana.app"

	versions: {
		"v1alpha1": {
			kinds: [staledashboardtrackerv1alpha1]
			served: true
			codegen: {
				ts: {enabled: false}
				go: {enabled: true}
			}
		}
	}

	extraPermissions: {
		accessKinds: [
			{group: "dashboard.grafana.app", resource: "dashboards", actions: ["get", "list"]},
		]
	}
	roles: {}
}

v1alpha1: {
	kinds: [staledashboardtrackerv1alpha1]
	served: true
}
