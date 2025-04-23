// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1beta1

// ConversionStatus is the status of the conversion of the dashboard.
// +k8s:openapi-gen=true
type DashboardConversionStatus struct {
	// Whether from another version has failed.
	// If true, means that the dashboard is not valid,
	// and the caller should instead fetch the stored version.
	Failed bool `json:"failed"`
	// The version which was stored when the dashboard was created / updated.
	// Fetching this version should always succeed.
	StoredVersion string `json:"storedVersion"`
	// The error message from the conversion.
	// Empty if the conversion has not failed.
	Error string `json:"error"`
}

// NewDashboardConversionStatus creates a new DashboardConversionStatus object.
func NewDashboardConversionStatus() *DashboardConversionStatus {
	return &DashboardConversionStatus{}
}

// +k8s:openapi-gen=true
type DashboardStatus struct {
	// Optional conversion status.
	Conversion *DashboardConversionStatus `json:"conversion,omitempty"`
}

// NewDashboardStatus creates a new DashboardStatus object.
func NewDashboardStatus() *DashboardStatus {
	return &DashboardStatus{}
}
