// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type ListEventsBody struct {
	Items []ListEventsV0alpha1BodyItems `json:"items"`
}

// NewListEventsBody creates a new ListEventsBody object.
func NewListEventsBody() *ListEventsBody {
	return &ListEventsBody{
		Items: []ListEventsV0alpha1BodyItems{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for ListEventsBody.
func (ListEventsBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.colorshapes.pkg.apis.colorshapes.v0alpha1.ListEventsBody"
}

// +k8s:openapi-gen=true
type ListEventsV0alpha1BodyItems struct {
	EventId    string `json:"eventId"`
	ProjectId  string `json:"projectId"`
	Message    string `json:"message"`
	OccurredAt int64  `json:"occurredAt"`
}

// NewListEventsV0alpha1BodyItems creates a new ListEventsV0alpha1BodyItems object.
func NewListEventsV0alpha1BodyItems() *ListEventsV0alpha1BodyItems {
	return &ListEventsV0alpha1BodyItems{}
}

// OpenAPIModelName returns the OpenAPI model name for ListEventsV0alpha1BodyItems.
func (ListEventsV0alpha1BodyItems) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.colorshapes.pkg.apis.colorshapes.v0alpha1.ListEventsV0alpha1BodyItems"
}
