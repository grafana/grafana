package userstorage

manifest: {
	appName:       "userstorage"
	groupOverride: "userstorage.grafana.app"
	versions: {
		"v0alpha1": {
			codegen: {
				ts: {enabled: false}
				go: {enabled: true}
			}
			kinds: [
				userStorageV0alpha1,
			]
		}
	}
	roles: {}
}
