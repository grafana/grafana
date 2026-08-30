package folder

manifest: {
	appName:          "folder"
	groupOverride:    "folder.grafana.app"
	preferredVersion: "v1"

	versions: {
		"v1": {
			codegen: {
				ts: {enabled: false}
				go: {enabled: true}
			}
			kinds: [
				foldersV1,
			]
		}
		"v1beta1": {
			codegen: {
				ts: {enabled: false}
				go: {enabled: false} // v1beta1 is a thin wrapper around v1
			}
			kinds: [
				foldersV1beta1,
			]
		}
	}
	roles: {}
}
