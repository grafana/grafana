package expr

import "github.com/grafana/grafana/pkg/util/errutil"

func MakeConversionError(refID string, err error) error {
	return errutil.NewBase(
		errutil.StatusBadRequest,
		"sse.readDataError",
	).MustTemplate(
		"[{{ .Public.refId }}] got error: {{ .Error }}",
		errutil.WithPublic(
			"failed to read data from from query {{ .Public.refId }}: {{ .Public.error }}",
		),
	).Build(errutil.TemplateData{
		// Conversion errors should only have meta information in errors
		Public: map[string]interface{}{
			"refId": refID,
			"error": err.Error(),
		},
		Error: err,
	})
}

var QueryError = errutil.NewBase(
	errutil.StatusBadRequest, "sse.dataQueryError").
	MustTemplate(
		"failed to execute query [{{ .Public.refId }}]: {{ .Error }}",
		errutil.WithPublic(
			"failed to execute query [{{ .Public.refId }}]",
		),
	)

func MakeQueryError(refID, datasourceUID string, err error) error {
	return QueryError.Build(errutil.TemplateData{
		Public: map[string]interface{}{
			"refId":         refID,
			"datasourceUID": datasourceUID,
		},
		Error: err,
	})
}
