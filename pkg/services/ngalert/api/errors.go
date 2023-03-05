package api

import (
	"errors"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/services/datasources"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/util/errutil"
)

var (
	errUnexpectedDatasourceType       = errutil.NewBase(errutil.StatusBadRequest, "alerting.unexpected-datasource-type")
	ErrAlertingStatusNotFound         = errutil.NewBase(errutil.StatusNotFound, "alerting.status-not-found")
	ErrAlertingStatusBadRequest       = errutil.NewBase(errutil.StatusBadRequest, "alerting.bad-request")
	ErrAlertingInternalError          = errutil.NewBase(errutil.StatusInternal, "alerting.internal")
	ErrAlertingStatusConflict         = errutil.NewBase(errutil.StatusInternal, "alerting.status-conflict")
	ErrAlertingStatusValidationFailed = errutil.NewBase(errutil.StatusValidationFailed, "alerting.validation-failed", errutil.WithPublicMessage("At least one Alertmanager must be provided or configured as a datasource that handles alerts to choose this option"))
	ErrAlertingStatusForbidden        = errutil.NewBase(errutil.StatusForbidden, "alerting.forbidden,")
	ErrAlertingNonExistentOrg         = errutil.NewBase(errutil.StatusNotFound, "alerting.status-not-found", errutil.WithPublicMessage("Alertmanager does not exist for this organization"))
)

func unexpectedDatasourceTypeError(actual string, expected string) error {
	return errUnexpectedDatasourceType.Errorf("Unexpected data source type '%s', expected %s", actual, expected)
}

func backendTypeDoesNotMatchPayloadTypeError(backendType apimodels.Backend, payloadType string) error {
	return ErrAlertingInternalError.Errorf("unexpeected backend type (%s) for payload type (%s)",
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
