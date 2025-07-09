package playlist

manifest: {
	appName:       "playlist"
	groupOverride: "playlist.grafana.app"
	versions: {
		"v0alpha1": {
			kinds: [
				playlistv0alpha1,
			]
		}
	}
}
