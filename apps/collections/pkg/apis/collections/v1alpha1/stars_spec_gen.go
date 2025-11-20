// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

// +k8s:openapi-gen=true
type StarsResource struct {
	Group string `json:"group"`
	Kind  string `json:"kind"`
	// The set of resources
	// +listType=set
	Names []string `json:"names"`
}

// NewStarsResource creates a new StarsResource object.
func NewStarsResource() *StarsResource {
	return &StarsResource{
		Names: []string{},
	}
}

// +k8s:openapi-gen=true
type StarsSpec struct {
	Resource []StarsResource `json:"resource"`
}

// NewStarsSpec creates a new StarsSpec object.
func NewStarsSpec() *StarsSpec {
	return &StarsSpec{
		Resource: []StarsResource{},
	}
}
