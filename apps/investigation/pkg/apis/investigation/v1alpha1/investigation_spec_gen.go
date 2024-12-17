package v1alpha1

// InvestigationSpec spec is the schema of our resource. The spec should include all the user-ediable information for the kind.
// +k8s:openapi-gen=true
type InvestigationSpec struct {
	Title string `json:"title"`
}
