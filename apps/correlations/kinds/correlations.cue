package kinds

correlationsv0alpha1: {
	kind:       "Correlation"  // note: must be uppercase
	pluralName: "Correlations"
	schema: {
		spec: {
			source_ds_ref:  DataSourceRef
			target_ds_ref?:  DataSourceRef
			label:       string
			description?: string
			config:      ConfigSpec
			provisioned: bool
			type:        CorrelationType
		}
	}
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
	type: string
	expression: string
	field: string
	mapValue: string
}

CorrelationType: "query" | "external"