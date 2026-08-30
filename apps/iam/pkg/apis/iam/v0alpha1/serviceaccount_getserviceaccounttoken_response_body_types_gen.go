// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type GetServiceAccountTokenToken struct {
	Title    string `json:"title"`
	Revoked  bool   `json:"revoked"`
	Expires  int64  `json:"expires"`
	Created  int64  `json:"created"`
	Updated  int64  `json:"updated"`
	LastUsed int64  `json:"lastUsed"`
}

// NewGetServiceAccountTokenToken creates a new GetServiceAccountTokenToken object.
func NewGetServiceAccountTokenToken() *GetServiceAccountTokenToken {
	return &GetServiceAccountTokenToken{}
}

// OpenAPIModelName returns the OpenAPI model name for GetServiceAccountTokenToken.
func (GetServiceAccountTokenToken) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.GetServiceAccountTokenToken"
}

// +k8s:openapi-gen=true
type GetServiceAccountTokenBody struct {
	Body GetServiceAccountTokenToken `json:"body"`
}

// NewGetServiceAccountTokenBody creates a new GetServiceAccountTokenBody object.
func NewGetServiceAccountTokenBody() *GetServiceAccountTokenBody {
	return &GetServiceAccountTokenBody{
		Body: *NewGetServiceAccountTokenToken(),
	}
}

// OpenAPIModelName returns the OpenAPI model name for GetServiceAccountTokenBody.
func (GetServiceAccountTokenBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.GetServiceAccountTokenBody"
}
