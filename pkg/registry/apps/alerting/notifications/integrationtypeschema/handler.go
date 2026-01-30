package integrationtypeschema

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

	"github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alertingnotifications/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
)

type Handler struct{}

func New() *Handler {
	return &Handler{}
}

// HandleGetSchemas handles GET requests for receiver integration schemas
// Returns schemas wrapped in K8s-style metadata for migration compatibility
func (h *Handler) HandleGetSchemas(ctx context.Context, writer app.CustomRouteResponseWriter, req *app.CustomRouteRequest) error {
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

	// Get namespace (org)
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return &apierrors.StatusError{
			ErrStatus: metav1.Status{
				Status:  metav1.StatusFailure,
				Code:    http.StatusBadRequest,
				Message: "namespace required",
			},
		}
	}

	// Get namespace mapper
	namespacer := request.GetNamespaceMapper(nil) // Using default config

	// Get all integration schemas from the alerting library
	schemas := notify.GetSchemaForAllIntegrations()

	// Sort by type for consistent ordering
	slices.SortFunc(schemas, func(a, b schema.IntegrationTypeSchema) int {
		return strings.Compare(string(a.Type), string(b.Type))
	})

	// Wrap each schema with K8s-style metadata
	items := make([]v0alpha1.IntegrationTypeSchemaResource, 0, len(schemas))
	for _, s := range schemas {
		// Marshal to JSON and unmarshal to spec type for conversion
		data, err := json.Marshal(s)
		if err != nil {
			continue
		}
		var spec v0alpha1.IntegrationTypeSchema
		if err := json.Unmarshal(data, &spec); err != nil {
			continue
		}

		item := v0alpha1.IntegrationTypeSchemaResource{
			Metadata: v0alpha1.V0alpha1IntegrationTypeSchemaResourceMetadata{
				Name:      string(s.Type),
				Namespace: namespacer(info.OrgID),
			},
			Spec: spec,
		}
		items = append(items, item)
	}

	// Return as items array in K8s list format
	response := map[string]interface{}{
		"items": items,
	}

	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(http.StatusOK)
	return json.NewEncoder(writer).Encode(response)
}
