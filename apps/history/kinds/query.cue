package kinds

queryV0alpha1: {
	kind:       "Query"  // note: must be uppercase
	pluralName: "Queries"
	schema: {
		spec: {
			comment?: string
			queries: [...QueryInfo]
		}
	}
}

QueryInfo: {
	refId: string 
  datasource: DataSourceRef
	properties: _ // the 
}	

DataSourceRef: {
   group: string // same as pluginId
	 version: string // apiversion
   name: string // same as grafana uid
}
