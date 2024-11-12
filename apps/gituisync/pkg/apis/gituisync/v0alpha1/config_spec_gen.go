package v0alpha1

// ConfigSpec defines model for ConfigSpec.
// +k8s:openapi-gen=true
type ConfigSpec struct {
	NoopValueHere bool `json:"noop_value_here"`
}
