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

// Type definition for investigation summaries
export interface InvestigationSummary {
	title: string;
	createdByProfile: Person;
	hasCustomName: boolean;
	isFavorite: boolean;
	overviewNote: string;
	overviewNoteUpdatedAt: string;
	viewMode: ViewMode;
	// +listType=atomic
	collectableSummaries: CollectableSummary[];
}

export const defaultInvestigationSummary = (): InvestigationSummary => ({
	title: "",
	createdByProfile: defaultPerson(),
	hasCustomName: false,
	isFavorite: false,
	overviewNote: "",
	overviewNoteUpdatedAt: "",
	viewMode: defaultViewMode(),
	collectableSummaries: [],
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

export interface CollectableSummary {
	id: string;
	title: string;
	logoPath: string;
	origin: string;
}

export const defaultCollectableSummary = (): CollectableSummary => ({
	id: "",
	title: "",
	logoPath: "",
	origin: "",
});

export interface Spec {
	// Title of the index, e.g. 'Favorites' or 'My Investigations'
	title: string;
	// The Person who owns this investigation index
	owner: Person;
	// Array of investigation summaries
	// +listType=atomic
	investigationSummaries: InvestigationSummary[];
}

export const defaultSpec = (): Spec => ({
	title: "",
	owner: defaultPerson(),
	investigationSummaries: [],
});

