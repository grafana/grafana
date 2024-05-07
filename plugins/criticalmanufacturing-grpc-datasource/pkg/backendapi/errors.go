package backendapi

import (
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/pkg/errors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func backendErrorResponse(err error) (data.Frames, error) {
	st := status.Convert(err)
	backend.Logger.Error(st.Code().String(), "error", err)
	return nil, convertBackendError(st)
}

// convertBackendError converts a grpc status code to a plugin error message
func convertBackendError(st *status.Status) error {
	switch st.Code() {
	case codes.DeadlineExceeded:
		return errors.Errorf("%s: Query did not complete within the expected timeframe; please check your query configuration or try to select a smaller period", st.Code())
	default:
		return errors.Errorf("%s: %s", st.Code(), st.Message())
	}
}
