package kinds

// This is our Investigation definition, which contains metadata about the kind, and the kind's schema
investigation: {
	group:      "investigation"
	kind:       "Investigation"
	pluralName: "Investigations"
	scope:      "Namespaced"

	apiResource: {
		groupOverride: "investigation.grafana.app"
	}

	codegen: {
		frontend: false
		backend:  true
	}

	current: "v1alpha1"
	versions: {
		"v1alpha1": {
			version: "v1alpha1"
			schema: {
				// spec is the schema of our resource. The spec should include all the user-ediable information for the kind.
				spec: #InvestigationSpec
			}
		}
	}
}

#InvestigationSpec: {
	title:  string
	status: "open" | "closed"
	items: [...#InvestigationItem]
}

// InvestigationItem is an item in an investigation.
#InvestigationItem: {
	id:    string
	title: string
	// type is the type of the item "timeseries", "heatmap", "log-table" (not an enum to allow for future extensions).
	type: string
	// url is the URL to the item.
	url: string
	// origin is where the item was created from.
	origin: string // "explore-metrics", "explore-logs", "explore-traces" (not an enum to allow for future extensions)
	// iconPath (optional) is the path to the icon for the item.
	iconPath?: string
	// timeRange (optional) is the time range of the item.
	timeRange: #AbsoluteTimeRange
	// note (optional) is a comment on the item.
	note?: [...#Comment]
	// queryType is the type of the query used to generate this item.
	queryType: "logs" | "metrics"
	// dataQuery contains the query used to generate this item.
	dataQuery: #DataQueryLogs | #DataQueryMetrics
}

// DataQueryLogs is a data query for logs.
#DataQueryLogs: {
	// refId is the reference ID of the query.
	refId: string
	// datasource is the datasource of the query.
	datasource: #DatasourceRef
	// expr is the expression of the query.
	expr: string
	// maxLines (optional) is used to limit the number of log rows returned.
	maxLines?: int64
}

// DataQueryMetrics is a data query for metrics.
#DataQueryMetrics: {
	refId:      string
	datasource: #DatasourceRef
	expr:       string
}

// Comment is a comment on an investigation item.
#Comment: {
	authorUserID: string
	bodyMarkdown: string
}

// DatasourceRef is a reference to a datasource.
#DatasourceRef: {
	uid:        string
	type:       string
	apiVersion: string
	name:       string
}

// AbsoluteTimeRange is a time range specified by absolute timestamps.
#AbsoluteTimeRange: {
	from: number
	to:   number
}
