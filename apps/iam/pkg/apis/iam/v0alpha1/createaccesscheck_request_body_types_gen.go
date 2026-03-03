// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

type CreateAccessCheckRequestAccessCheckRequest struct {
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

// NewCreateAccessCheckRequestAccessCheckRequest creates a new CreateAccessCheckRequestAccessCheckRequest object.
func NewCreateAccessCheckRequestAccessCheckRequest() *CreateAccessCheckRequestAccessCheckRequest {
	return &CreateAccessCheckRequestAccessCheckRequest{}
}

// OpenAPIModelName returns the OpenAPI model name for CreateAccessCheckRequestAccessCheckRequest.
func (CreateAccessCheckRequestAccessCheckRequest) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.CreateAccessCheckRequestAccessCheckRequest"
}

type CreateAccessCheckRequestBody struct {
	// named checks
	Check map[string]CreateAccessCheckRequestAccessCheckRequest `json:"check"`
	// Include the request inside the response
	Debug bool `json:"debug"`
	// forces the access checker to skip any caching layer
	SkipCache bool `json:"skipCache"`
}

// NewCreateAccessCheckRequestBody creates a new CreateAccessCheckRequestBody object.
func NewCreateAccessCheckRequestBody() *CreateAccessCheckRequestBody {
	return &CreateAccessCheckRequestBody{
		Check: map[string]CreateAccessCheckRequestAccessCheckRequest{},
		Debug: false,
	}
}

// OpenAPIModelName returns the OpenAPI model name for CreateAccessCheckRequestBody.
func (CreateAccessCheckRequestBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.CreateAccessCheckRequestBody"
}
