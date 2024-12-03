package v0alpha1

// FeedbackSpec defines model for FeedbackSpec.
// +k8s:openapi-gen=true
type FeedbackSpec struct {
	Message string `json:"message"`
}
