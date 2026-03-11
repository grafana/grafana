package kinds

manifest: {
	appName: "shorturl"
	groupOverride: "shorturl.grafana.app"
	versions: {
	    "v1beta1": {
	        kinds: [shorturl]
	    }
	}
	roles: {}
}
