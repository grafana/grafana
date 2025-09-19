// Code generated - EDITING IS FUTILE. DO NOT EDIT.

export interface Interval {
	times?: TimeRange[];
	weekdays?: string[];
	days_of_month?: string[];
	months?: string[];
	years?: string[];
	location?: string;
}

export const defaultInterval = (): Interval => ({
});

export interface TimeRange {
	start_time: string;
	end_time: string;
}

export const defaultTimeRange = (): TimeRange => ({
	start_time: "",
	end_time: "",
});

export interface Spec {
	name: string;
	time_intervals: Interval[];
}

export const defaultSpec = (): Spec => ({
	name: "",
	time_intervals: [],
});

