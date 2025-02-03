// Code generated - EDITING IS FUTILE. DO NOT EDIT.

// ConversionStatus is the status of the conversion of the dashboard.
export interface ConversionStatus {
	failed: boolean;
	storedVersion: string;
	error: string;
}

export const defaultConversionStatus = (): ConversionStatus => ({
	failed: false,
	storedVersion: "",
	error: "",
});

export interface Status {
	conversion?: ConversionStatus;
}

export const defaultStatus = (): Status => ({
});

