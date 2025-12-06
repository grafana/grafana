// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

// +k8s:openapi-gen=true
type Spec struct {
	DefaultFields      []string `json:"defaultFields"`
	PrettifyJSON       bool     `json:"prettifyJSON"`
	WrapLogMessage     bool     `json:"wrapLogMessage"`
	InterceptDismissed bool     `json:"interceptDismissed"`
}

// NewSpec creates a new Spec object.
func NewSpec() *Spec {
	return &Spec{
		DefaultFields: []string{},
	}
}
