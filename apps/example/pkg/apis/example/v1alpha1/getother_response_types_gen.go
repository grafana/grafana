// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

// +k8s:openapi-gen=true
type GetOtherBody struct {
	Message string `json:"message"`
}

// NewGetOtherBody creates a new GetOtherBody object.
func NewGetOtherBody() *GetOtherBody {
	return &GetOtherBody{}
}
func (GetOtherBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.example.pkg.apis.example.v1alpha1.GetOtherBody"
}
