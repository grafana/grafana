package kinds

import (
	v2beta1 "github.com/grafana/grafana/sdkkinds/dashboard/v2beta1"
)

notebookV2beta1: {
	kind:       "Notebook"
	pluralName: "Notebooks"
	search: {
		global: true
	}
	searchFields: [
		{
			name: "content"
			type: "string"
			capabilities: ["text"]
			description: "The text of the notebook's Markdown cells"
		},
	]
	validation: {
		operations: ["CREATE", "UPDATE"]
	}
	mutation: {
		operations: ["CREATE", "UPDATE"]
	}
	schema: {
		spec: v2beta1.NotebookSpec
	}
}
