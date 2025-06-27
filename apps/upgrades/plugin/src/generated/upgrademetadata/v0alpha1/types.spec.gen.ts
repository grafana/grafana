// Code generated - EDITING IS FUTILE. DO NOT EDIT.

export interface Spec {
	starting_version: string;
	target_version: string;
	state: "new" | "dismissed" | "failed" | "succeeded";
}

export const defaultSpec = (): Spec => ({
	starting_version: "",
	target_version: "",
	state: "new",
});

