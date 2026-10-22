// Code generated - EDITING IS FUTILE. DO NOT EDIT.

export interface SavedViewVariable {
	name: string;
	// "adhoc" | "query" | "custom" | ...
	type: string;
	// value is the variable's scalar or multi-value selection (query/custom/datasource variables).
	// Omitted for ad-hoc variables, which carry their state in filters instead.
	value?: string | string[];
	filters?: SavedViewFilter[];
}

export const defaultSavedViewVariable = (): SavedViewVariable => ({
	name: "",
	type: "",
});

export interface SavedViewFilter {
	key: string;
	operator: string;
	value: string;
}

export const defaultSavedViewFilter = (): SavedViewFilter => ({
	key: "",
	operator: "",
	value: "",
});

export interface SavedViewSectionFilter {
	sectionKind: "tab" | "row";
	sectionKey: string;
	// sectionTitle is the tab/row's title at capture time, used to sanity-check on apply that the
	// section resolved at sectionKey still looks like the same one -- layout edits (reordering,
	// inserting, deleting tabs/rows) can leave sectionKey resolving successfully but to a
	// different section. Optional for backward compatibility with views saved before this field
	// existed; those still apply unconditionally, same as before.
	sectionTitle?: string;
	variables: SavedViewVariable[];
}

export const defaultSavedViewSectionFilter = (): SavedViewSectionFilter => ({
	sectionKind: "tab",
	sectionKey: "",
	variables: [],
});

export interface Spec {
	// dashboardUID is the dashboard this view belongs to. A view only ever applies to the
	// dashboard it was created on.
	dashboardUID: string;
	// name is the user-facing label for this view (distinct from metadata.name, which is the
	// resource's system-generated identifier).
	name: string;
	// description is an optional user-facing note about this view.
	description?: string;
	timeRange: {
		from: string;
		to: string;
		timezone?: string;
	};
	variables: SavedViewVariable[];
	// sectionFilters captures ad-hoc filters scoped to a tab or row rather than the whole
	// dashboard. Stretch goal — omitted entirely on dashboards that don't use tabs/rows.
	sectionFilters?: SavedViewSectionFilter[];
}

export const defaultSpec = (): Spec => ({
	dashboardUID: "",
	name: "",
	timeRange: {
	from: "",
	to: "",
},
	variables: [],
});

