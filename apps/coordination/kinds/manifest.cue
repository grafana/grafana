package kinds

manifest: {
	appName:       "coordination"
	groupOverride: "coordination.grafana.app"
	versions: {
		"v0alpha1": {
			kinds: [lease, clusterLease]
		}
	}
	roles: {}
}
