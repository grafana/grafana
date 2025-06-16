// Code generated - EDITING IS FUTILE. DO NOT EDIT.

// ConversionStatus is the status of the conversion of the dashboard.
export interface ConversionStatus {
	// Whether from another version has failed.
	// If true, means that the dashboard is not valid,
	// and the caller should instead fetch the stored version.
	failed: boolean;
	// The version which was stored when the dashboard was created / updated.
	// Fetching this version should always succeed.
	storedVersion: string;
	// The error message from the conversion.
	// Empty if the conversion has not failed.
	error: string;
}

export const defaultConversionStatus = (): ConversionStatus => ({
	failed: false,
	storedVersion: "",
	error: "",
});

export interface Status {
	// Optional conversion status.
	conversion?: ConversionStatus;
}

export const defaultStatus = (): Status => ({
});

