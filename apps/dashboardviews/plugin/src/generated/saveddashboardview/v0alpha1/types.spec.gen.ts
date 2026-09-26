// Code generated - EDITING IS FUTILE. DO NOT EDIT.

export interface SavedViewVariable {
	name: string;
	// "adhoc" | "query" | "custom" | ...
	type: string;
	value: any;
	filters?: SavedViewFilter[];
}

export const defaultSavedViewVariable = (): SavedViewVariable => ({
	name: "",
	type: "",
	value: {},
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

