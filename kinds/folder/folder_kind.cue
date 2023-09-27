package kind

name:        "Folder"
maturity:    "merged"
description: "A folder is a collection of resources that are grouped together and can share permissions."

lineage: schemas: [{
	version: [0, 0]
	schema: {
		spec: {
			// Unique folder id. (will be k8s name)
			uid: string

			// Folder title
			title: string

			// Description of the folder.
			description?: string
		} @cuetsy(kind="interface")
		//
		// TODO:
		// common metadata will soon support setting the parent folder in the metadata
		//
	}
}]
