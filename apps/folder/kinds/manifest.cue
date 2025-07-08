package folder

manifest: {
	appName:       "folder"
	groupOverride: "folder.grafana.app"
	versions: {
		"v1beta1": {
			codegen: {
				ts: {
					enabled: false
				}
				go: {
					enabled: true
				}
			}
			kinds: [
				folderv1beta1,
			]
		}
	}
}
