// Code generated - EDITING IS FUTILE. DO NOT EDIT.

// #DefinedType is a re-usable definition for us to use in our schema.
// Fields leading with # are definitions in CUE and won't be included in the generated types.
export interface DefinedType {
	// Info is information about this entry. This comment, like all comments
	// on fields or definitions, will be copied into the generated types as well.
	info: string;
	// Next is an optional next element in the DefinedType, allowing for a self-referential
	// linked-list like structure. The ? in the field makes this optional.
	next?: DefinedType;
}

export const defaultDefinedType = (): DefinedType => ({
	info: "",
});

// Spec is the schema of our resource. The spec should include all the user-editable information for the kind.
export interface Spec {
	// Example fields
	firstField: string;
	secondField: number;
	list?: DefinedType;
}

export const defaultSpec = (): Spec => ({
	firstField: "",
	secondField: 0,
});

