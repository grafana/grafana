package kinds

saveddashboardviewv0alpha1: {
	kind:       "SavedDashboardView" // note: must be uppercase
	pluralName: "SavedDashboardViews"
	schema: {
		spec: {
			// dashboardUID is the dashboard this view belongs to. A view only ever applies to the
			// dashboard it was created on.
			dashboardUID: string
			// name is the user-facing label for this view (distinct from metadata.name, which is the
			// resource's system-generated identifier).
			name: string
			timeRange: {
				from: string
				to:   string
				timezone?: string
			}
			variables: [...SavedViewVariable]
			// sectionFilters captures ad-hoc filters scoped to a tab or row rather than the whole
			// dashboard. Stretch goal — omitted entirely on dashboards that don't use tabs/rows.
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
	value: _
	filters?: [...SavedViewFilter]
}

SavedViewFilter: {
	key:      string
	operator: string
	value:    string
}

SavedViewSectionFilter: {
	sectionKind: "tab" | "row"
	sectionKey:  string
	variables: [...SavedViewVariable]
}
