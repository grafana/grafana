package playlist

manifest: {
	appName:       "playlist"
	groupOverride: "playlist.grafana.app"
	versions: {
		"v0alpha1": {
			codegen: {
				ts: {enabled: false}
				go: {enabled: true}
			}
			kinds: [
				playlistv0alpha1,
			]
		}
	}
}
