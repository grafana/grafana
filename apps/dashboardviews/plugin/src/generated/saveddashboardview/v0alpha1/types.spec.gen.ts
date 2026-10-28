// Code generated - EDITING IS FUTILE. DO NOT EDIT.

export interface SavedViewVariable {
	name: string;
	// "adhoc" | "query" | "custom" | ...
	type: string;
	// value is omitted for ad hoc variables, which use filters instead.
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
	// values holds the selection for multi-value operators.
	values?: string[];
}

export const defaultSavedViewFilter = (): SavedViewFilter => ({
	key: "",
	operator: "",
	value: "",
});

export interface SavedViewSectionFilter {
	sectionKind: "tab" | "row";
	sectionKey: string;
	// sectionTitle guards against layout edits leaving sectionKey pointing at a different section.
	sectionTitle?: string;
	variables: SavedViewVariable[];
}

export const defaultSavedViewSectionFilter = (): SavedViewSectionFilter => ({
	sectionKind: "tab",
	sectionKey: "",
	variables: [],
});

export interface Spec {
	// dashboardUID is the dashboard this view belongs to.
	dashboardUID: string;
	// name is the user-facing title, distinct from the generated metadata.name.
	name: string;
	timeRange: {
		from: string;
		to: string;
		timezone?: string;
	};
	variables: SavedViewVariable[];
	// sectionFilters captures ad hoc filters scoped to a tab or row.
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

