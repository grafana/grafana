// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type AnnotationDashboard struct {
	// The dashboard k8s name (grafana UID)
	Name  string `json:"name"`
	Panel *int64 `json:"panel,omitempty"`
}

// NewAnnotationDashboard creates a new AnnotationDashboard object.
func NewAnnotationDashboard() *AnnotationDashboard {
	return &AnnotationDashboard{}
}

// +k8s:openapi-gen=true
type AnnotationAlert struct {
	Id *int64 `json:"id,omitempty"`
	// The alert k8s name (grafana UID)
	Name      string `json:"name"`
	PrevState string `json:"prevState"`
	NewState  string `json:"newState"`
	// TODO? is there a more specific model
	Data map[string]interface{} `json:"data"`
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
	Time int64 `json:"time"`
	// when the annotation is a range, this is the right side
	TimeEnd *int64 `json:"timeEnd,omitempty"`
	// Display the annotation on a specific dashboard + panel
	Dashboard *AnnotationDashboard `json:"dashboard,omitempty"`
	// The source alert data
	Alert *AnnotationAlert `json:"alert,omitempty"`
}

// NewAnnotationSpec creates a new AnnotationSpec object.
func NewAnnotationSpec() *AnnotationSpec {
	return &AnnotationSpec{}
}
