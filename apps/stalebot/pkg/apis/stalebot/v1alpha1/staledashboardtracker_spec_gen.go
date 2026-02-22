// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

// +k8s:openapi-gen=true
type StaleDashboardTrackerSpec struct {
	// Dashboard UID to track
	DashboardUID string `json:"dashboardUID"`
	// Threshold in days after which a dashboard is considered stale
	// if not viewed or updated
	StaleDaysThreshold uint64 `json:"staleDaysThreshold"`
	// Whether to check view activity
	TrackViews bool `json:"trackViews"`
	// Whether to check update activity
	TrackUpdates bool `json:"trackUpdates"`
	// Optional notification settings
	Notification *StaleDashboardTrackerV1alpha1SpecNotification `json:"notification,omitempty"`
}

// NewStaleDashboardTrackerSpec creates a new StaleDashboardTrackerSpec object.
func NewStaleDashboardTrackerSpec() *StaleDashboardTrackerSpec {
	return &StaleDashboardTrackerSpec{
		TrackViews:   true,
		TrackUpdates: true,
	}
}

// OpenAPIModelName returns the OpenAPI model name for StaleDashboardTrackerSpec.
func (StaleDashboardTrackerSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.stalebot.pkg.apis.stalebot.v1alpha1.StaleDashboardTrackerSpec"
}

// +k8s:openapi-gen=true
type StaleDashboardTrackerV1alpha1SpecNotification struct {
	Enabled  bool     `json:"enabled"`
	Channels []string `json:"channels,omitempty"`
}

// NewStaleDashboardTrackerV1alpha1SpecNotification creates a new StaleDashboardTrackerV1alpha1SpecNotification object.
func NewStaleDashboardTrackerV1alpha1SpecNotification() *StaleDashboardTrackerV1alpha1SpecNotification {
	return &StaleDashboardTrackerV1alpha1SpecNotification{}
}

// OpenAPIModelName returns the OpenAPI model name for StaleDashboardTrackerV1alpha1SpecNotification.
func (StaleDashboardTrackerV1alpha1SpecNotification) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.stalebot.pkg.apis.stalebot.v1alpha1.StaleDashboardTrackerV1alpha1SpecNotification"
}
