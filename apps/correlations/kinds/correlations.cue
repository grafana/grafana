package kinds

correlationsv0alpha1: {
	kind:       "Correlation"  // note: must be uppercase
	pluralName: "Correlations"
	schema: {
		spec: {
			type:         CorrelationType
			source:       DataSourceRef
			target?:      DataSourceRef
			description?: string
			label:        string
			config:       ConfigSpec
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

/*todo this is incorrect - target needs to be an object with any sort of key/value combination 
inside of it
for external correlations, this is just `target: { url: 'google.com' }` ,
but for query correlations, target is the json for populating the query editor, which is different
for every datasource

right now this is resolving to require an object of objects, like item.spec.config.target.url is expecting an object
instead of a string. how do i fix this? */
TargetSpec:  [string]: _

TransformationSpec: {
	type: "regex" | "logfmt"
	expression: string
	field: string
	mapValue: string
}

CorrelationType: "query" | "external"