// Code generated - EDITING IS FUTILE. DO NOT EDIT.

export interface Spec {
	use_default_ttl: boolean;
	ttl_ms: number;
	ttl_resources_ms: number;
	enabled: boolean;
}

export const defaultSpec = (): Spec => ({
	use_default_ttl: false,
	ttl_ms: 0,
	ttl_resources_ms: 0,
	enabled: false,
});

