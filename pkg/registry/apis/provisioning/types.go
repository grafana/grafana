package provisioning

import (
	"context"
	"net/http"

	"k8s.io/apimachinery/pkg/util/validation/field"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
)

type Repository interface {
	// This is called before trying to create/update a saved resource
	// This is not an indication that the connection information works,
	// just that they are reasonably configured
	Validate() field.ErrorList

	// Called to check if all connection information actually works
	Test(ctx context.Context) error

	// Read a resource from settings
	ReadResource(ctx context.Context, path string, commit string) (*provisioning.ResourceWrapper, error)

	// For repositories that support webhooks
	Webhook() http.HandlerFunc
}
