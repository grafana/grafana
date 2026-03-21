package kinds

queryhistory: {
	kind:       "QueryHistory"
	pluralName: "QueryHistories"
	scope:      "Namespaced"
	validation: {
		operations: ["CREATE", "UPDATE"]
	}
	mutation: {
		operations: ["CREATE", "UPDATE"]
	}
	schema: {
		spec: {
			// Primary datasource UID
			datasourceUid: string
			// Opaque JSON blob of DataQuery objects
			queries: _
			// User-editable comment
			comment?: string
		}
	}
	selectableFields: [
		"spec.datasourceUid",
	]
	routes: {
		"/search": {
			"GET": {
				name: "getSearch"
				response: {
					items: [..._]
					totalCount?: int64
				}
			}
		}
	}
}
