// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type ListServiceAccountTokensToken struct {
	Title    string `json:"title"`
	Revoked  bool   `json:"revoked"`
	Expires  int64  `json:"expires"`
	Created  int64  `json:"created"`
	Updated  int64  `json:"updated"`
	LastUsed int64  `json:"lastUsed"`
}

// NewListServiceAccountTokensToken creates a new ListServiceAccountTokensToken object.
func NewListServiceAccountTokensToken() *ListServiceAccountTokensToken {
	return &ListServiceAccountTokensToken{}
}

// OpenAPIModelName returns the OpenAPI model name for ListServiceAccountTokensToken.
func (ListServiceAccountTokensToken) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.ListServiceAccountTokensToken"
}

// +k8s:openapi-gen=true
type ListServiceAccountTokensBody struct {
	Items    []ListServiceAccountTokensToken `json:"items"`
	Continue string                          `json:"continue"`
}

// NewListServiceAccountTokensBody creates a new ListServiceAccountTokensBody object.
func NewListServiceAccountTokensBody() *ListServiceAccountTokensBody {
	return &ListServiceAccountTokensBody{
		Items: []ListServiceAccountTokensToken{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for ListServiceAccountTokensBody.
func (ListServiceAccountTokensBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.ListServiceAccountTokensBody"
}
