// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type GetReceiverIntegrationTestBody struct {
	Status string `json:"status"`
}

// NewGetReceiverIntegrationTestBody creates a new GetReceiverIntegrationTestBody object.
func NewGetReceiverIntegrationTestBody() *GetReceiverIntegrationTestBody {
	return &GetReceiverIntegrationTestBody{
		Status: "ok",
	}
}
