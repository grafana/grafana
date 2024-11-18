package v0alpha1

// SecureValueSpec defines model for SecureValueSpec.
// +k8s:openapi-gen=true
type SecureValueSpec struct {
	// The APIs that are allowed to decrypt this secret
	// Support and behavior is still TBD, but could likely look like:
	// * testdata.grafana.app/{name1}
	// * testdata.grafana.app/{name2}
	// * runner.k6.grafana.app  -- allow any k6 test runner
	// Rather than a string pattern, we may want a more explicit object:
	// [{ group:"testdata.grafana.app", name="name1"},
	//  { group:"runner.k6.grafana.app"}]
	Apis []string `json:"apis"`

	// Name of the manager
	// This is only supported in enterprise
	Manager string `json:"manager"`

	// When using a remote Key manager, the path is used to
	// reference a value inside the remote storage
	// NOTE: this value is only expected on write
	Path string `json:"path"`

	// Visible title for this secret
	Title string `json:"title"`

	// The raw value is only valid for write.  Read/List will always be empty
	// Writing with an empty value will always fail
	Value string `json:"value"`
}
