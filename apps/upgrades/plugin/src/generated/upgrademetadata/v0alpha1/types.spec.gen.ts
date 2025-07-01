// Code generated - EDITING IS FUTILE. DO NOT EDIT.

export interface Spec {
	starting_version: string;
	target_version: string;
	state: "new" | "dismissed" | "failed" | "succeeded";
	is_out_of_support: boolean;
	target_release_date: string;
}

export const defaultSpec = (): Spec => ({
	starting_version: "",
	target_version: "",
	state: "new",
	is_out_of_support: false,
	target_release_date: "",
});

