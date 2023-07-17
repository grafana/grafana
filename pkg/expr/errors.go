package expr

import "github.com/grafana/grafana/pkg/util/errutil"

func MakeReadError(refID string, err error) error {
	return errutil.NewBase(
		errutil.StatusBadRequest,
		"sse.readDataError",
	).MustTemplate(
		"[{{ .Public.refId }}] got error: {{ .Error }}",
		errutil.WithPublic(
			"failed to read data from from query {{ .Public.refId }}",
		),
	).Build(errutil.TemplateData{
		Public: map[string]interface{}{
			"refId": refID,
		},
		Error: err,
	})
}

// type QueryError struct {
// 	RefID         string
// 	DatasourceUID string
// 	Err           error
// }

// func (e QueryError) Error() string {
// 	return fmt.Sprintf("failed to execute query %s: %s", e.RefID, e.Err)
// }

// func (e QueryError) Unwrap() error {
// 	return e.Err
// }

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
