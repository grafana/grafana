package receiverschema

import (
	"context"
	"encoding/json"
	"net/http"
	"slices"
	"strings"

	"github.com/grafana/alerting/notify"
	"github.com/grafana/alerting/receivers/schema"
	"github.com/grafana/grafana-app-sdk/app"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

type Handler struct{}

func New() *Handler {
	return &Handler{}
}

// HandleGetSchemas handles GET requests for receiver integration schemas
// Returns schemas in IntegrationTypeSchema (v2) format
func (h *Handler) HandleGetSchemas(ctx context.Context, writer app.CustomRouteResponseWriter, request *app.CustomRouteRequest) error {
	// Verify user is authenticated
	_, err := identity.GetRequester(ctx)
	if err != nil {
		return &apierrors.StatusError{
			ErrStatus: metav1.Status{
				Status:  metav1.StatusFailure,
				Code:    http.StatusUnauthorized,
				Message: "authentication required",
			},
		}
	}

	// Get all integration schemas from the alerting library
	schemas := notify.GetSchemaForAllIntegrations()

	// Sort by type for consistent ordering
	slices.SortFunc(schemas, func(a, b schema.IntegrationTypeSchema) int {
		return strings.Compare(string(a.Type), string(b.Type))
	})

	// Wrap in response object for consistency with other app platform APIs
	response := map[string]interface{}{
		"schemas": schemas,
	}

	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(http.StatusOK)
	return json.NewEncoder(writer).Encode(response)
}
