// Code generated - EDITING IS FUTILE. DO NOT EDIT.

// Person represents a user profile with basic information
export interface Person {
	// Unique identifier for the user
	uid: string;
	// Display name of the user
	name: string;
	// URL to user's Gravatar image
	gravatarUrl: string;
}

export const defaultPerson = (): Person => ({
	uid: "",
	name: "",
	gravatarUrl: "",
});

// Collectable represents an item collected during investigation
export interface Collectable {
	id: string;
	createdAt: string;
	title: string;
	origin: string;
	type: string;
	// +listType=atomic
	queries: string[];
	timeRange: TimeRange;
	datasource: DatasourceRef;
	url: string;
	logoPath?: string;
	note: string;
	noteUpdatedAt: string;
	fieldConfig: string;
}

export const defaultCollectable = (): Collectable => ({
	id: "",
	createdAt: "",
	title: "",
	origin: "",
	type: "",
	queries: [],
	timeRange: defaultTimeRange(),
	datasource: defaultDatasourceRef(),
	url: "",
	note: "",
	noteUpdatedAt: "",
	fieldConfig: "",
});

// TimeRange represents a time range with both absolute and relative values
export interface TimeRange {
	from: string;
	to: string;
	raw: {
		from: string;
		to: string;
	};
}

export const defaultTimeRange = (): TimeRange => ({
	from: "",
	to: "",
	raw: {
	from: "",
	to: "",
},
});

// DatasourceRef is a reference to a datasource
export interface DatasourceRef {
	uid: string;
}

export const defaultDatasourceRef = (): DatasourceRef => ({
	uid: "",
});

export interface ViewMode {
	mode: "compact" | "full";
	showComments: boolean;
	showTooltips: boolean;
}

export const defaultViewMode = (): ViewMode => ({
	mode: "compact",
	showComments: false,
	showTooltips: false,
});

// spec is the schema of our resource
export interface Spec {
	title: string;
	createdByProfile: Person;
	hasCustomName: boolean;
	isFavorite: boolean;
	overviewNote: string;
	overviewNoteUpdatedAt: string;
	// +listType=atomic
	collectables: Collectable[];
	viewMode: ViewMode;
}

export const defaultSpec = (): Spec => ({
	title: "",
	createdByProfile: defaultPerson(),
	hasCustomName: false,
	isFavorite: false,
	overviewNote: "",
	overviewNoteUpdatedAt: "",
	collectables: [],
	viewMode: defaultViewMode(),
});

