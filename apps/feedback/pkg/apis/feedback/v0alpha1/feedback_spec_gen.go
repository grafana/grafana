// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type FeedbackSpec struct {
	Message       string `json:"message"`
	Screenshot    []byte `json:"screenshot"`
	ScreenshotUrl string `json:"screenshotUrl"`
}

// NewFeedbackSpec creates a new FeedbackSpec object.
func NewFeedbackSpec() *FeedbackSpec {
	return &FeedbackSpec{}
}
