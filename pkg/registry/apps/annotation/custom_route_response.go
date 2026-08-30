package annotation

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/grafana/grafana-app-sdk/app"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

type customRouteHandler func(context.Context, app.CustomRouteResponseWriter, *app.CustomRouteRequest) error

func withAPIStatusErrorResponse(next customRouteHandler) customRouteHandler {
	return func(ctx context.Context, writer app.CustomRouteResponseWriter, request *app.CustomRouteRequest) error {
		err := next(ctx, writer, request)
		if err == nil {
			return nil
		}

		var statusErr apierrors.APIStatus
		if !errors.As(err, &statusErr) {
			return err
		}

		status := statusErr.Status()
		if status.Code < http.StatusBadRequest || status.Code >= http.StatusInternalServerError {
			return err
		}

		writer.Header().Set("Content-Type", "application/json")
		writer.WriteHeader(int(status.Code))
		_ = json.NewEncoder(writer).Encode(status)
		return nil
	}
}
