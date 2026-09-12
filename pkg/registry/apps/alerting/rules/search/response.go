package search

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/simple"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

// WithAPIStatusErrorResponse writes a client error to the response rather than
// returning it, so a rejected query is reported with the status it carries.
//
// The app-sdk turns any error returned from a custom route into a hardcoded 500
// with err.Error() as the message, discarding the status (see the
// CallCustomRoute branch in k8s/apiserver/installer.go). Returning a 400 from a
// handler therefore reaches the client as a server fault. The annotation app
// works around it the same way.
//
// Only 4xx is intercepted. A 5xx really is a server fault, so it is still
// returned and keeps whatever logging the sdk applies.
func WithAPIStatusErrorResponse(next simple.AppCustomRouteHandler) simple.AppCustomRouteHandler {
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
