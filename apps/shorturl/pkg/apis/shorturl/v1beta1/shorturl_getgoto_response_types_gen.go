// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1beta1

// +k8s:openapi-gen=true
type GetGotoBody struct {
	Url string `json:"url"`
}

// NewGetGotoBody creates a new GetGotoBody object.
func NewGetGotoBody() *GetGotoBody {
	return &GetGotoBody{}
}
func (GetGotoBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.shorturl.pkg.apis.shorturl.v1beta1.GetGotoBody"
}
