// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type NotificationSpec struct {
	RecipientUID string               `json:"recipientUID"`
	OrgID        int64                `json:"orgID"`
	Type         NotificationSpecType `json:"type"`
	// RFC3339
	CreatedAt string                         `json:"createdAt"`
	Source    NotificationV0alpha1SpecSource `json:"source"`
	Actor     NotificationV0alpha1SpecActor  `json:"actor"`
	// bounded at 280 chars by producer
	Excerpt string `json:"excerpt"`
}

// NewNotificationSpec creates a new NotificationSpec object.
func NewNotificationSpec() *NotificationSpec {
	return &NotificationSpec{
		Source: *NewNotificationV0alpha1SpecSource(),
		Actor:  *NewNotificationV0alpha1SpecActor(),
	}
}

// OpenAPIModelName returns the OpenAPI model name for NotificationSpec.
func (NotificationSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.notifications.pkg.apis.notifications.v0alpha1.NotificationSpec"
}

// +k8s:openapi-gen=true
type NotificationV0alpha1SpecSource struct {
	Kind         string `json:"kind"`
	CommentUID   string `json:"commentUID"`
	ThreadUID    string `json:"threadUID"`
	DashboardUID string `json:"dashboardUID"`
	DeepLink     string `json:"deepLink"`
}

// NewNotificationV0alpha1SpecSource creates a new NotificationV0alpha1SpecSource object.
func NewNotificationV0alpha1SpecSource() *NotificationV0alpha1SpecSource {
	return &NotificationV0alpha1SpecSource{
		Kind: "comment",
	}
}

// OpenAPIModelName returns the OpenAPI model name for NotificationV0alpha1SpecSource.
func (NotificationV0alpha1SpecSource) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.notifications.pkg.apis.notifications.v0alpha1.NotificationV0alpha1SpecSource"
}

// +k8s:openapi-gen=true
type NotificationV0alpha1SpecActor struct {
	Uid   string `json:"uid"`
	Login string `json:"login"`
	Name  string `json:"name"`
}

// NewNotificationV0alpha1SpecActor creates a new NotificationV0alpha1SpecActor object.
func NewNotificationV0alpha1SpecActor() *NotificationV0alpha1SpecActor {
	return &NotificationV0alpha1SpecActor{}
}

// OpenAPIModelName returns the OpenAPI model name for NotificationV0alpha1SpecActor.
func (NotificationV0alpha1SpecActor) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.notifications.pkg.apis.notifications.v0alpha1.NotificationV0alpha1SpecActor"
}

// +k8s:openapi-gen=true
type NotificationSpecType string

const (
	NotificationSpecTypeMention NotificationSpecType = "mention"
	NotificationSpecTypeReply   NotificationSpecType = "reply"
)

// OpenAPIModelName returns the OpenAPI model name for NotificationSpecType.
func (NotificationSpecType) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.notifications.pkg.apis.notifications.v0alpha1.NotificationSpecType"
}
