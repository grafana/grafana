package kinds

correlationsv0alpha1: {
	kind:       "Correlation"  // note: must be uppercase
	pluralName: "Correlations"
	schema: {
		spec: {
			source_uid:  string
			target_uid:  string
			label:       string
			description: string
			config:      ConfigSpec
			provisioned: bool
			type:        CorrelationType
		}
	}
}

ConfigSpec: {
	field: string
	type: string
	target: TargetSpec
	transformations: [...TransformationSpec] | *[]
}

TargetSpec:  [string]: _

TransformationSpec: {
	type: string
	expression: string
	field: string
	mapValue: string
}

CorrelationType: "query" | "external"