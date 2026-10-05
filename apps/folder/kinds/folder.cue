package folder

foldersV1: {
	kind:       "Folder"
	pluralName: "Folders"
	search: hybrid: true
	embed: fields: [
		{name: "title", path: "spec.title"},
		{name: "description", path: "spec.description"},
	]

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
