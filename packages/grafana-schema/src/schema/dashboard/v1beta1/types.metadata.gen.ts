// Code generated - EDITING IS FUTILE. DO NOT EDIT.

// metadata contains embedded CommonMetadata and can be extended with custom string fields
// TODO: use CommonMetadata instead of redefining here; currently needs to be defined here
// without external reference as using the CommonMetadata reference breaks thema codegen.
export interface Metadata {
	updateTimestamp: string;
	createdBy: string;
	uid: string;
	creationTimestamp: string;
	deletionTimestamp?: string;
	finalizers: string[];
	resourceVersion: string;
	generation: number;
	updatedBy: string;
	labels: Record<string, string>;
}

export const defaultMetadata = (): Metadata => ({
	updateTimestamp: "",
	createdBy: "",
	uid: "",
	creationTimestamp: "",
	finalizers: [],
	resourceVersion: "",
	generation: 0,
	updatedBy: "",
	labels: {},
});

