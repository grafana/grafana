// Code generated - EDITING IS FUTILE. DO NOT EDIT.
//
// Using jennies:
//     GoRawTypes

package publicdashboard

type PublicDashboard struct {
	// Unique public dashboard identifier
	Uid string `json:"uid"`
	// Dashboard unique identifier referenced by this public dashboard
	DashboardUid string `json:"dashboardUid"`
	// Unique public access token
	AccessToken *string `json:"accessToken,omitempty"`
	// Flag that indicates if the public dashboard is enabled
	IsEnabled bool `json:"isEnabled"`
	// Flag that indicates if annotations are enabled
	AnnotationsEnabled bool `json:"annotationsEnabled"`
	// Flag that indicates if the time range picker is enabled
	TimeSelectionEnabled bool `json:"timeSelectionEnabled"`
}
