package api

import (
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/api/response"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

var (
	errBackendDoesNotExist      = errors.New("unknown backend type")
	errUnexpectedBackendType    = errors.New("unexpected backend type")
	errUnexpectedDatasourceType = errors.New("unexpected datasource type")
)

func unexpectedDatasourceType(actual string, expected string) error {
	return fmt.Errorf("%w '%s', expected %s", errUnexpectedDatasourceType, actual, expected)
}

func unexpectedBackendTypeError(actual, expected apimodels.Backend) error {
	return fmt.Errorf("%w '%s', expected %s", errUnexpectedBackendType, actual, expected)
}

func backendTypeDoesNotMatchPayloadTypeError(backendType apimodels.Backend, payloadType string) error {
	return fmt.Errorf("unexpected backend type (%s) for payload type (%s)",
		backendType.String(),
		payloadType,
	)
}

func errorToResponse(err error) response.Response {
	if errors.Is(err, errBackendDoesNotExist) {
		return ErrResp(404, err, "")
	}
	if errors.Is(err, errUnexpectedBackendType) || errors.Is(err, errUnexpectedDatasourceType) {
		return ErrResp(400, err, "")
	}
	return ErrResp(500, err, "")
}
