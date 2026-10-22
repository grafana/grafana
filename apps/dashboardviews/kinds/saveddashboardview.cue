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
			// description is an optional user-facing note about this view.
			description?: string
			timeRange: {
				from:      string
				to:        string
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
	// value is the variable's scalar or multi-value selection (query/custom/datasource variables).
	// Omitted for ad-hoc variables, which carry their state in filters instead.
	value?: string | [...string]
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
	// sectionTitle is the tab/row's title at capture time, used to sanity-check on apply that the
	// section resolved at sectionKey still looks like the same one -- layout edits (reordering,
	// inserting, deleting tabs/rows) can leave sectionKey resolving successfully but to a
	// different section. Optional for backward compatibility with views saved before this field
	// existed; those still apply unconditionally, same as before.
	sectionTitle?: string
	variables: [...SavedViewVariable]
}
