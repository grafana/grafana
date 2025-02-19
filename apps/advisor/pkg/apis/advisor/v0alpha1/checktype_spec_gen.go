// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type CheckTypeStep struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	StepID      string `json:"stepID"`
	Resolution  string `json:"resolution"`
}

// NewCheckTypeStep creates a new CheckTypeStep object.
func NewCheckTypeStep() *CheckTypeStep {
	return &CheckTypeStep{}
}

// +k8s:openapi-gen=true
type CheckTypeSpec struct {
	Name  string          `json:"name"`
	Steps []CheckTypeStep `json:"steps"`
}

// NewCheckTypeSpec creates a new CheckTypeSpec object.
func NewCheckTypeSpec() *CheckTypeSpec {
	return &CheckTypeSpec{}
}
