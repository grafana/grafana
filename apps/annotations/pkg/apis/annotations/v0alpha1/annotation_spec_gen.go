// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type AnnotationDashboard struct {
	Name  string `json:"name"`
	Panel *int64 `json:"panel,omitempty"`
}

// NewAnnotationDashboard creates a new AnnotationDashboard object.
func NewAnnotationDashboard() *AnnotationDashboard {
	return &AnnotationDashboard{}
}

// +k8s:openapi-gen=true
type AnnotationAlert struct {
	Id        *int64                 `json:"id,omitempty"`
	Name      string                 `json:"name"`
	PrevState string                 `json:"prevState"`
	NewState  string                 `json:"newState"`
	Data      map[string]interface{} `json:"data"`
}

// NewAnnotationAlert creates a new AnnotationAlert object.
func NewAnnotationAlert() *AnnotationAlert {
	return &AnnotationAlert{
		Data: map[string]interface{}{},
	}
}

// +k8s:openapi-gen=true
type AnnotationSpec struct {
	// Display text (supports markdown)
	Text string `json:"text"`
	// Query tags
	Tags []string `json:"tags,omitempty"`
	// milliseconds to draw the annotation
	Epoch int64 `json:"epoch"`
	// when the annotation is a range, this is the right side
	EpochEnd  *int64               `json:"epochEnd,omitempty"`
	Dashboard *AnnotationDashboard `json:"dashboard,omitempty"`
	// The source alert data
	Alert *AnnotationAlert `json:"alert,omitempty"`
}

// NewAnnotationSpec creates a new AnnotationSpec object.
func NewAnnotationSpec() *AnnotationSpec {
	return &AnnotationSpec{}
}
