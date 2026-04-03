package folder

foldersV1: {
	kind:       "Folder"
	pluralName: "Folders"

	schema: {
		spec: {
			title:        string
			description?: string
		}
	}

	selectableFields: [
		"spec.title",
	]
}

foldersV1beta1: foldersV1
