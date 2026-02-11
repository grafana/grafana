package kinds

myresource: {
	kind:       "MyResource"
	pluralName: "MyResources"
	validation: operations: ["CREATE", "UPDATE"]
	schema: {
		spec: {
			// A human-readable title for this resource
			title: string
			// The content/body of the resource
			content: string
		}
		status: {
			// Whether the resource is ready
			ready: bool
		}
	}
}
