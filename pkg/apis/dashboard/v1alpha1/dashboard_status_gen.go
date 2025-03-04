// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

// ConversionStatus is the status of the conversion of the dashboard.
// +k8s:openapi-gen=true
type DashboardConversionStatus struct {
	Failed        bool   `json:"failed"`
	StoredVersion string `json:"storedVersion"`
	Error         string `json:"error"`
}

// NewDashboardConversionStatus creates a new DashboardConversionStatus object.
func NewDashboardConversionStatus() *DashboardConversionStatus {
	return &DashboardConversionStatus{}
}

// +k8s:openapi-gen=true
type DashboardStatus struct {
	Conversion *DashboardConversionStatus `json:"conversion,omitempty"`
}

// NewDashboardStatus creates a new DashboardStatus object.
func NewDashboardStatus() *DashboardStatus {
	return &DashboardStatus{}
}
