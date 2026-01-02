package live

manifest: {
	appName:       "live"
	groupOverride: "live.grafana.app"
	versions: {
		"v1beta1": {
			codegen: {
				ts: {enabled: false}
				go: {enabled: true}
			}
			kinds: [
				channelV1beta1,
			]
		}
	}
}