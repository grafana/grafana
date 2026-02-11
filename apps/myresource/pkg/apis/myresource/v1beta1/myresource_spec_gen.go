// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1beta1

// +k8s:openapi-gen=true
type MyResourceSpec struct {
	// A human-readable title for this resource
	Title string `json:"title"`
	// The content/body of the resource
	Content string `json:"content"`
}

// NewMyResourceSpec creates a new MyResourceSpec object.
func NewMyResourceSpec() *MyResourceSpec {
	return &MyResourceSpec{}
}

func (MyResourceSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.myresource.pkg.apis.myresource.v1beta1.MyResourceSpec"
}
