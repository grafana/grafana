package integrationtypeschema

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"strings"

	"github.com/grafana/alerting/notify"
	"github.com/grafana/alerting/receivers/schema"
	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alertingnotifications/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/ngalert/accesscontrol"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// AccessControlService provides access control for receivers.
type AccessControlService interface {
	AuthorizeReadSome(ctx context.Context, user identity.Requester) error
}

type Handler struct {
	ac AccessControlService
}

func New(ac AccessControlService) *Handler {
	return &Handler{
		ac: ac,
	}
}

// HandleGetSchemas handles GET requests for receiver integration schemas
// Returns schemas wrapped in K8s-style metadata for migration compatibility
func (h *Handler) HandleGetSchemas(ctx context.Context, writer app.CustomRouteResponseWriter, req *app.CustomRouteRequest) error {
	// Verify user is authenticated
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return &apierrors.StatusError{
			ErrStatus: metav1.Status{
				Status:  metav1.StatusFailure,
				Code:    http.StatusUnauthorized,
				Message: "authentication required",
			},
		}
	}

	if err := h.ac.AuthorizeReadSome(ctx, user); err != nil {
		var (
			msg     string
			utilErr errutil.Error
		)

		if errors.As(err, &utilErr) && utilErr.Reason.Status() == errutil.StatusForbidden {
			msg = utilErr.PublicMessage

			if errors.Is(err, accesscontrol.ErrAuthorizationBase) {
				msg = fmt.Sprintf("required permissions: %s", utilErr.PublicPayload["permissions"])
			}
		}

		return &apierrors.StatusError{
			ErrStatus: metav1.Status{
				Status:  metav1.StatusFailure,
				Code:    http.StatusUnauthorized,
				Message: msg,
			},
		}
	}

	schemas := notify.GetSchemaForAllIntegrations()
	slices.SortFunc(schemas, func(a, b schema.IntegrationTypeSchema) int {
		return strings.Compare(string(a.Type), string(b.Type))
	})

	// Wrap each schema with K8s-style metadata for future-proofing migration
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
				Namespace: req.ResourceIdentifier.Namespace,
			},
			Spec: spec,
		}
		items = append(items, item)
	}

	// Return as items array in K8s list format
	response := map[string]interface{}{
		"apiVersion": v0alpha1.GroupVersion.String(),
		"kind":       "IntegrationTypeSchemaList",
		"metadata":   map[string]any{},
		"items":      items,
	}

	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(http.StatusOK)
	return json.NewEncoder(writer).Encode(response)
}
