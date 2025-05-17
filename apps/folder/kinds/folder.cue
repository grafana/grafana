package folder

folder: {
	kind:       "Folder"
	pluralName: "Folders"
	current:    "v1beta1"
	codegen: {
		ts: {
			enabled: false // Not sure if it should be enabled or not, currently it is.
		}
		go: {
			enabled: true
		}
	}

	versions: {
		"v1beta1": {
			schema: {
				spec: {
					title:    string
					description?: string
				}
				status: {} // nothing
			}
		}
	}
}
