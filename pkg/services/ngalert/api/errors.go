package api

import (
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/services/datasources"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

var (
	errUnexpectedDatasourceType = errors.New("unexpected datasource type")
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
	if errors.Is(err, datasources.ErrDataSourceNotFound) {
		return ErrResp(404, err, "")
	}
	if errors.Is(err, errUnexpectedDatasourceType) {
		return ErrResp(400, err, "")
	}
	if errors.Is(err, ErrAuthorization) {
		return ErrResp(401, err, "")
	}
	return ErrResp(500, err, "")
}
