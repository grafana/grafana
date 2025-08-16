package preferences

starsV1alpha1: {
	kind:       "Stars"
	pluralName: "Stars"
	scope:      "Namespaced"

	validation: {
		operations: [
			"CREATE",
			"UPDATE",
		]
	}
	schema: {
		#Resource: {
			group: string
			kind: string

			// The set of resources
      // +listType=set
			names: [...string]
		}
		spec: {
			resource: [...#Resource]
		}
	}
}