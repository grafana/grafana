package historian

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/ngalert/api"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

type Historian interface {
	Query(ctx context.Context, query models.HistoryQuery) (*data.Frame, error)
}

type handlers struct {
	historian Historian
}

func (h handlers) GetAlertStateHistoryHandler(ctx context.Context, writer app.CustomRouteResponseWriter, request *app.CustomRouteRequest) error {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return &apierrors.StatusError{
			ErrStatus: metav1.Status{
				Status:  metav1.StatusFailure,
				Code:    http.StatusUnauthorized,
				Message: "authentication required",
			}}
	}

	query, err := api.ParseHistoryQuery(user.GetOrgID(), user, request.URL.Query())
	if err != nil {
		return &apierrors.StatusError{
			ErrStatus: metav1.Status{
				Status:  metav1.StatusFailure,
				Code:    http.StatusBadRequest,
				Message: err.Error(),
			}}
	}

	frame, err := h.historian.Query(ctx, query)
	if err != nil {
		return &apierrors.StatusError{
			ErrStatus: metav1.Status{
				Status:  metav1.StatusFailure,
				Code:    http.StatusInternalServerError,
				Message: err.Error(),
			}}
	}

	writer.Header().Add("Content-Type", "application/json")
	writer.WriteHeader(http.StatusOK)
	return json.NewEncoder(writer).Encode(frame)
}
