package preferences

starsV1alpha1: {
	kind:       "Stars"
	pluralName: "Stars"
	scope:      "Namespaced"

	// Access is decided by the owner in the name, not by a folder.
	folderScoped: false
	namingStrategy: {
		mode: "owner"
		owner: {
			owners: ["user"]
			allowOrgAdmin: true
		}
	}

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
	routes: {
		"/update/{group}/{kind}/{id}": {
			"PUT": {
				operationId:        "addStar"
				description:        "Add a starred item"
				responseKind:       "Stars"
				allowMissingParent: true
				request: parameters: _itemParams
			}
			"DELETE": {
				operationId:        "removeStar"
				description:        "Remove a starred item"
				responseKind:       "Stars"
				allowMissingParent: true
				request: parameters: _itemParams
			}
		}
	}
	_itemParams: [
		{
			name:        "group"
			in:          "path"
			description: "API group for stared item"
			example:     "dashboard.grafana.app"
		},
		{
			name:        "kind"
			in:          "path"
			description: "Kind for stared item"
			example:     "Dashboard"
		},
		{
			name:        "id"
			in:          "path"
			description: "The k8s name for the selected item"
		},
	]
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
