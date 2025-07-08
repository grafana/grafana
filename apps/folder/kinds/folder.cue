package folder

folderv1beta1: {
	kind:   "Folder"
	plural: "folders"
	scope:  "Namespaced"
	schema: {
		spec: {
			title:        string
			description?: string
		}
		status: {} // nothing
	}
}
