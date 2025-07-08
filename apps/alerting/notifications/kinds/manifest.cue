package kinds

manifest: {
	appName:       "alerting"
	versions: {
		"v0alpha1": {
			codegen: {
				frontend: false
				backend:  true
			}
			kinds: [
				receiverv0alpha1,
				routeTreev0alpha1,
				templateGroupv0alpha1,
				timeIntervalv0alpha1,
			]
		}
	}
}
