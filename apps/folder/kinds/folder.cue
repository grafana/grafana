package folder

folder: {
	kind:       "Folder"
	pluralName: "Folders"
	current:    "v1beta1"
	versions: {
		"v1beta1": {
			codegen: {
				frontend: false
				backend:  true
			}
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
