// Code generated - EDITING IS FUTILE. DO NOT EDIT.

export interface Resource {
	group: string;
	kind: string;
	// The set of resources
	// +listType=set
	names: string[];
}

export const defaultResource = (): Resource => ({
	group: "",
	kind: "",
	names: [],
});

export interface Spec {
	resource: Resource[];
}

export const defaultSpec = (): Spec => ({
	resource: [],
});

