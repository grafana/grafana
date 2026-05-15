package palettes

manifest: {
	appName:       "palettes"
	groupOverride: "palettes.grafana.app"
	versions: {
		"v0alpha1": {
			codegen: {
				ts: {enabled: false}
				go: {enabled: true}
			}
			kinds: [
				paletteV0alpha1,
			]
		}
	}
	roles: {}
}
