// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type TemplateGroupTemplateKind string

const (
	TemplateGroupTemplateKindGrafana TemplateGroupTemplateKind = "grafana"
	TemplateGroupTemplateKindMimir   TemplateGroupTemplateKind = "mimir"
)

// OpenAPIModelName returns the OpenAPI model name for TemplateGroupTemplateKind.
func (TemplateGroupTemplateKind) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v0alpha1.TemplateGroupTemplateKind"
}

// +k8s:openapi-gen=true
type TemplateGroupSpec struct {
	Title   string                    `json:"title"`
	Content string                    `json:"content"`
	Kind    TemplateGroupTemplateKind `json:"kind"`
}

// NewTemplateGroupSpec creates a new TemplateGroupSpec object.
func NewTemplateGroupSpec() *TemplateGroupSpec {
	return &TemplateGroupSpec{
		Kind: TemplateGroupTemplateKindGrafana,
	}
}

// OpenAPIModelName returns the OpenAPI model name for TemplateGroupSpec.
func (TemplateGroupSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v0alpha1.TemplateGroupSpec"
}
