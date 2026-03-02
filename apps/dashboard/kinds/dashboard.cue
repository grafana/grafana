package kinds

// Status is the shared status of all dashboard versions.
DashboardStatus: {
	// Optional conversion status.
	conversion?: ConversionStatus
}

// ConversionStatus is the status of the conversion of the dashboard.
ConversionStatus: {
	// Whether from another version has failed.
	// If true, means that the dashboard is not valid,
	// and the caller should instead fetch the stored version.
	failed: bool

	// The error message from the conversion.
	// Empty if the conversion has not failed.
	error?: string

	// The version which was stored when the dashboard was created / updated.
	// Fetching this version should always succeed.
	storedVersion?: string

  // The original value map[string]any
	source?: _
}
