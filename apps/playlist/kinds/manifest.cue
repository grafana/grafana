package playlist

manifest: {
	appName:       "playlist"
	groupOverride: "playlist.grafana.app"
	versions: {
		"v0alpha1": {
			codegen: {
				frontend: false
				backend:  true
			}
			kinds: [
				playlistv0alpha1,
			]
		}
	}
}
