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

// NotifierPlugin represents the v1 (legacy) format for receiver integration schemas
type NotifierPlugin struct {
	Type        string         `json:"type"`
	TypeAlias   string         `json:"typeAlias,omitempty"`
	Name        string         `json:"name"`
	Heading     string         `json:"heading"`
	Description string         `json:"description"`
	Info        string         `json:"info"`
	Options     []schema.Field `json:"options"`
}

type Handler struct{}

func New() *Handler {
	return &Handler{}
}

// HandleGetSchemas handles GET requests for receiver integration schemas
// Supports both v1 (legacy) and v2 (native) formats via version query parameter
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
	v2 := notify.GetSchemaForAllIntegrations()

	// Sort by type for consistent ordering
	slices.SortFunc(v2, func(a, b schema.IntegrationTypeSchema) int {
		return strings.Compare(string(a.Type), string(b.Type))
	})

	// Check version parameter to determine format
	version := request.URL.Query().Get("version")

	if version == "2" {
		// Return v2 (native) format
		writer.Header().Set("Content-Type", "application/json")
		writer.WriteHeader(http.StatusOK)
		return json.NewEncoder(writer).Encode(v2)
	}

	// Convert to v1 (legacy) format
	result := convertToV1Format(v2)

	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(http.StatusOK)
	return json.NewEncoder(writer).Encode(result)
}

// convertToV1Format converts v2 schemas to the legacy v1 NotifierPlugin format
func convertToV1Format(schemas []schema.IntegrationTypeSchema) []*NotifierPlugin {
	result := make([]*NotifierPlugin, 0, len(schemas))

	for _, s := range schemas {
		// Get v1 version of the schema
		v1, ok := s.GetVersion(schema.V1)
		if !ok {
			// Skip integrations that don't support v1
			continue
		}

		result = append(result, &NotifierPlugin{
			Type:        string(s.Type),
			Name:        s.Name,
			Description: s.Description,
			Heading:     s.Heading,
			Info:        s.Info,
			Options:     v1.Options,
		})
	}

	return result
}
