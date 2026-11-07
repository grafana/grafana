package kinds

saveddashboardviewv0alpha1: {
	kind:       "SavedDashboardView" // note: must be uppercase
	pluralName: "SavedDashboardViews"
	// Generic read routes would bypass the per-dashboard checks in the storage authorizer.
	listKeys: false
	search: {
		endpoint: false
	}
	schema: {
		spec: {
			// dashboardUID is the dashboard this view belongs to.
			dashboardUID: string
			// name is the user-facing title, distinct from the generated metadata.name.
			name: string
			timeRange: {
				from:      string
				to:        string
				timezone?: string
			}
			variables: [...SavedViewVariable]
			// sectionFilters captures ad hoc filters scoped to a tab or row.
			sectionFilters?: [...SavedViewSectionFilter]
		}
	}
	selectableFields: [
		"spec.dashboardUID",
	]
}

SavedViewVariable: {
	name: string
	type: string // "adhoc" | "query" | "custom" | ...
	// value is omitted for ad hoc variables, which use filters instead.
	value?: string | [...string]
	filters?: [...SavedViewFilter]
}

SavedViewFilter: {
	key:      string
	operator: string
	value:    string
	// values holds the selection for multi-value operators.
	values?: [...string]
}

SavedViewSectionFilter: {
	sectionKind: "tab" | "row"
	sectionKey:  string
	// sectionTitle guards against layout edits leaving sectionKey pointing at a different section.
	sectionTitle?: string
	variables: [...SavedViewVariable]
}
