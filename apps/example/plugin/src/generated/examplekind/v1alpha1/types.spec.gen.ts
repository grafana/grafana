// Code generated - EDITING IS FUTILE. DO NOT EDIT.

// spec is the schema of our resource. The spec should include all the user-editable information for the kind.
// status is where state and status information which may be used or updated by the operator or back-end should be placed
// If you do not have any such information, you do not need to include this field,
// however, as mentioned above, certain fields will be added by the kind system regardless.
// status: {
// 	currentState: string
// }
// metadata if where kind- and schema-specific metadata goes. This is converted into typed annotations
// with getters and setters by the code generation.
// metadata: {
// 	kindSpecificField: string
// }
export interface Spec {
	// Example fields
	firstField: string;
	secondField: number;
}

export const defaultSpec = (): Spec => ({
	firstField: "",
	secondField: 0,
});

