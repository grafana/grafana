// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type ListHitsBody struct {
	Items []ListHitsV0alpha1BodyItems `json:"items"`
}

// NewListHitsBody creates a new ListHitsBody object.
func NewListHitsBody() *ListHitsBody {
	return &ListHitsBody{
		Items: []ListHitsV0alpha1BodyItems{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for ListHitsBody.
func (ListHitsBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.colorshapes.pkg.apis.colorshapes.v0alpha1.ListHitsBody"
}

// +k8s:openapi-gen=true
type ListHitsV0alpha1BodyItems struct {
	CreatedAt int64  `json:"createdAt"`
	SourceIp  string `json:"sourceIp"`
	Color     string `json:"color"`
	Shape     string `json:"shape"`
	CreatedBy string `json:"createdBy"`
}

// NewListHitsV0alpha1BodyItems creates a new ListHitsV0alpha1BodyItems object.
func NewListHitsV0alpha1BodyItems() *ListHitsV0alpha1BodyItems {
	return &ListHitsV0alpha1BodyItems{}
}

// OpenAPIModelName returns the OpenAPI model name for ListHitsV0alpha1BodyItems.
func (ListHitsV0alpha1BodyItems) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.colorshapes.pkg.apis.colorshapes.v0alpha1.ListHitsV0alpha1BodyItems"
}
