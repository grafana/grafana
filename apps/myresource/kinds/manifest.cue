package kinds

manifest: {
	appName: "myresource"
	groupOverride: "myresource.grafana.app"
	versions: {
		"v1beta1": {
			kinds: [myresource]
		}
	}
}
