package api

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/services/datasources"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

var (
	errUnexpectedDatasourceType = errors.New("unexpected datasource type")

	// errFolderAccess is used as a wrapper to propagate folder related errors and correctly map to the response status
	errFolderAccess = errors.New("cannot get folder")
)

func unexpectedDatasourceTypeError(actual string, expected string) error {
	return fmt.Errorf("%w '%s', expected %s", errUnexpectedDatasourceType, actual, expected)
}

func backendTypeDoesNotMatchPayloadTypeError(backendType apimodels.Backend, payloadType string) error {
	return fmt.Errorf("unexpected backend type (%s) for payload type (%s)",
		backendType.String(),
		payloadType,
	)
}

func errorToResponse(err error) response.Response {
	if errors.As(err, &errutil.Error{}) {
		return response.Err(err)
	}
	if errors.Is(err, datasources.ErrDataSourceNotFound) {
		return ErrResp(http.StatusNotFound, err, "")
	}
	if errors.Is(err, errUnexpectedDatasourceType) {
		return ErrResp(400, err, "")
	}
	if errors.Is(err, errFolderAccess) {
		return toNamespaceErrorResponse(err)
	}
	return ErrResp(http.StatusInternalServerError, err, "")
}
