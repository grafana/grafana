package expr

import (
	"errors"

	"github.com/grafana/grafana/pkg/util/errutil"
)

var ConversionError = errutil.NewBase(
	errutil.StatusBadRequest,
	"sse.readDataError",
).MustTemplate(
	"[{{ .Public.refId }}] got error: {{ .Error }}",
	errutil.WithPublic(
		"failed to read data from from query {{ .Public.refId }}: {{ .Public.error }}",
	),
)

func MakeConversionError(refID string, err error) error {
	data := errutil.TemplateData{
		// Conversion errors should only have meta information in errors
		Public: map[string]interface{}{
			"refId": refID,
			"error": err.Error(),
		},
		Error: err,
	}
	return ConversionError.Build(data)
}

var QueryError = errutil.NewBase(
	errutil.StatusBadRequest, "sse.dataQueryError").MustTemplate(
	"failed to execute query [{{ .Public.refId }}]: {{ .Error }}",
	errutil.WithPublic(
		"failed to execute query [{{ .Public.refId }}]: {{ .Public.error }}",
	))

func MakeQueryError(refID, datasourceUID string, err error) error {
	var pErr error
	var utilErr errutil.Error
	// See if this is grafana error, if so, grab public message
	if errors.As(err, &utilErr) {
		pErr = utilErr.Public()
	} else {
		pErr = err
	}

	data := errutil.TemplateData{
		Public: map[string]interface{}{
			"refId":         refID,
			"datasourceUID": datasourceUID,
			"error":         pErr.Error(),
		},
		Error: err,
	}

	return QueryError.Build(data)
}
