package playlist

manifest: {
	appName:       "playlist"
	groupOverride: "playlist.grafana.app"
	versions: {
		"v1": {
			storage: true
			codegen: {
				ts: {enabled: false}
				go: {enabled: true} // v1 is the generated version
			}
			kinds: [
				playlistv1,
			]
		}
		"v0alpha1": {
			codegen: {
				ts: {enabled: false}
				go: {enabled: false} // v0alpha1 is now a thin wrapper around v1
			}
			kinds: [
				playlistv0alpha1,
			]
		}
	}
	roles: {}
}
