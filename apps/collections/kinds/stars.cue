package preferences

starsV1alpha1: {
	kind:       "Stars"
	pluralName: "Stars"
	scope:      "Namespaced"

	// Access is decided by the owner in the name, not by a folder.
	folderScoped: false

	// Generic read routes cannot apply the caller filtering used by normal list reads.
	listKeys: false
	search: {
		endpoint: false
	}

	validation: {
		operations: [
			"CREATE",
			"UPDATE",
		]
	}
	mutation: {
		operations: [
			"CREATE",
			"UPDATE",
		]
	}
	schema: {
		#Resource: {
			group: string
			kind:  string

			// The set of resources
			// +listType=set
			names: [...string]
		}
		spec: {
			resource: [...#Resource]
		}
	}
}
