// Code generated - EDITING IS FUTILE. DO NOT EDIT.

export interface RouteDefaults {
	receiver: string;
	group_by?: string[];
	group_wait?: string;
	group_interval?: string;
	repeat_interval?: string;
}

export const defaultRouteDefaults = (): RouteDefaults => ({
	receiver: "",
});

export interface Route {
	receiver?: string;
	matchers?: Matcher[];
	continue: boolean;
	group_by?: string[];
	mute_time_intervals?: string[];
	active_time_intervals?: string[];
	routes?: Route[];
	group_wait?: string;
	group_interval?: string;
	repeat_interval?: string;
}

export const defaultRoute = (): Route => ({
	continue: false,
});

export interface Matcher {
	type: "=" | "!=" | "=~" | "!~";
	label: string;
	value: string;
}

export const defaultMatcher = (): Matcher => ({
	type: "=",
	label: "",
	value: "",
});

export interface Spec {
	defaults: RouteDefaults;
	routes: Route[];
}

export const defaultSpec = (): Spec => ({
	defaults: defaultRouteDefaults(),
	routes: [],
});

