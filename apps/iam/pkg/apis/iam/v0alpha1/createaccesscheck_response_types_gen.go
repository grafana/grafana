// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type CreateAccessCheckAccessCheckRequest struct {
	// The requested access verb.
	Verb string `json:"verb"`
	// API group (dashboards.grafana.app)
	Group string `json:"group"`
	// Kind eg dashboards
	Resource string `json:"resource"`
	// The specific resource
	Name string `json:"name"`
	// Optional subresource
	Subresource string `json:"subresource"`
	// Folder identifier
	Folder string `json:"folder"`
	// For non-resource requests, this will be the requested URL path
	Path string `json:"path"`
}

// NewCreateAccessCheckAccessCheckRequest creates a new CreateAccessCheckAccessCheckRequest object.
func NewCreateAccessCheckAccessCheckRequest() *CreateAccessCheckAccessCheckRequest {
	return &CreateAccessCheckAccessCheckRequest{}
}

// OpenAPIModelName returns the OpenAPI model name for CreateAccessCheckAccessCheckRequest.
func (CreateAccessCheckAccessCheckRequest) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.CreateAccessCheckAccessCheckRequest"
}

// +k8s:openapi-gen=true
type CreateAccessCheckResponse struct {
	Allowed map[string]bool `json:"allowed"`
	// Only included when the debug flag is enabled
	Debug *CreateAccessCheckV0alpha1ResponseDebug `json:"debug,omitempty"`
}

// NewCreateAccessCheckResponse creates a new CreateAccessCheckResponse object.
func NewCreateAccessCheckResponse() *CreateAccessCheckResponse {
	return &CreateAccessCheckResponse{
		Allowed: map[string]bool{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for CreateAccessCheckResponse.
func (CreateAccessCheckResponse) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.CreateAccessCheckResponse"
}

// +k8s:openapi-gen=true
type CreateAccessCheckV0alpha1ResponseDebugCheck struct {
	Check   CreateAccessCheckAccessCheckRequest `json:"check"`
	Allowed bool                                `json:"allowed"`
}

// NewCreateAccessCheckV0alpha1ResponseDebugCheck creates a new CreateAccessCheckV0alpha1ResponseDebugCheck object.
func NewCreateAccessCheckV0alpha1ResponseDebugCheck() *CreateAccessCheckV0alpha1ResponseDebugCheck {
	return &CreateAccessCheckV0alpha1ResponseDebugCheck{
		Check: *NewCreateAccessCheckAccessCheckRequest(),
	}
}

// OpenAPIModelName returns the OpenAPI model name for CreateAccessCheckV0alpha1ResponseDebugCheck.
func (CreateAccessCheckV0alpha1ResponseDebugCheck) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.CreateAccessCheckV0alpha1ResponseDebugCheck"
}

// +k8s:openapi-gen=true
type CreateAccessCheckV0alpha1ResponseDebugAuth struct {
	Name string `json:"name"`
	Type string `json:"type"`
	Uid  string `json:"uid"`
}

// NewCreateAccessCheckV0alpha1ResponseDebugAuth creates a new CreateAccessCheckV0alpha1ResponseDebugAuth object.
func NewCreateAccessCheckV0alpha1ResponseDebugAuth() *CreateAccessCheckV0alpha1ResponseDebugAuth {
	return &CreateAccessCheckV0alpha1ResponseDebugAuth{}
}

// OpenAPIModelName returns the OpenAPI model name for CreateAccessCheckV0alpha1ResponseDebugAuth.
func (CreateAccessCheckV0alpha1ResponseDebugAuth) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.CreateAccessCheckV0alpha1ResponseDebugAuth"
}

// +k8s:openapi-gen=true
type CreateAccessCheckV0alpha1ResponseDebug struct {
	Check map[string]CreateAccessCheckV0alpha1ResponseDebugCheck `json:"check"`
	Auth  CreateAccessCheckV0alpha1ResponseDebugAuth             `json:"auth"`
}

// NewCreateAccessCheckV0alpha1ResponseDebug creates a new CreateAccessCheckV0alpha1ResponseDebug object.
func NewCreateAccessCheckV0alpha1ResponseDebug() *CreateAccessCheckV0alpha1ResponseDebug {
	return &CreateAccessCheckV0alpha1ResponseDebug{
		Check: map[string]CreateAccessCheckV0alpha1ResponseDebugCheck{},
		Auth:  *NewCreateAccessCheckV0alpha1ResponseDebugAuth(),
	}
}

// OpenAPIModelName returns the OpenAPI model name for CreateAccessCheckV0alpha1ResponseDebug.
func (CreateAccessCheckV0alpha1ResponseDebug) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.CreateAccessCheckV0alpha1ResponseDebug"
}
