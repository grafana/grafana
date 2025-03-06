package common

// Status is the shared status of all dashboard versions.
DashboardStatus: {
	conversion?: ConversionStatus
}

// ConversionStatus is the status of the conversion of the dashboard.
ConversionStatus: {
	failed:        bool
	storedVersion: string
	error:         string
}
