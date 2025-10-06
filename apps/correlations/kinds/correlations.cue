package kinds

correlationsv0alpha1: {
	kind:       "Correlation"  // note: must be uppercase
	pluralName: "Correlations"
	schema: {
		spec: {
			description?: string
			label:       string
			datasource:  DataSourceRef
			target:  [...DataSourceRef]
			config:      ConfigSpec
			type:        CorrelationType
		}
	}
	selectableFields: [
		"spec.datasource.name"
	]
}

DataSourceRef: {
   group: string // same as pluginId
   name: string // same as grafana uid
}


// there was a deprecated field here called type, we will need to move that for conversion and provisioning
ConfigSpec: {
	field: string
	target: TargetSpec
	transformations?: [...TransformationSpec]
}

TargetSpec:  [string]: _

TransformationSpec: {
	type: "regex" | "logfmt"
	expression: string
	field: string
	mapValue: string
}

CorrelationType: "query" | "external"