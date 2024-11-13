package v0alpha1

// NoOpSpec defines model for NoOpSpec.
// +k8s:openapi-gen=true
type NoOpSpec struct {
	NoopValueHere bool `json:"noop_value_here"`
}
