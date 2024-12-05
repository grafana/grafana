// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type FeedbackSpec struct {
	Message            string         `json:"message"`
	Screenshot         []byte         `json:"screenshot,omitempty"`
	ImageType          *string        `json:"imageType,omitempty"`
	ScreenshotUrl      *string        `json:"screenshotUrl,omitempty"`
	GithubIssueUrl     *string        `json:"githubIssueUrl,omitempty"`
	CanContactReporter bool           `json:"canContactReporter"`
	CanAccessInstance  bool           `json:"canAccessInstance"`
	DiagnosticData     map[string]any `json:"diagnosticData,omitempty"`
}

// NewFeedbackSpec creates a new FeedbackSpec object.
func NewFeedbackSpec() *FeedbackSpec {
	return &FeedbackSpec{}
}
