package query

import (
	"errors"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
)

var QueryError = errutil.BadRequest("query.error").MustTemplate(
	"failed to execute query [{{ .Public.refId }}]: {{ .Error }}",
	errutil.WithPublic(
		"failed to execute query [{{ .Public.refId }}]: {{ .Public.error }}",
	))

func MakeQueryError(refID, err error) error {
	var pErr error
	var utilErr errutil.Error
	// See if this is grafana error, if so, grab public message
	if errors.As(err, &utilErr) {
		pErr = utilErr.Public()
	} else {
		pErr = err
	}

	data := errutil.TemplateData{
		Public: map[string]any{
			"refId": refID,
			"error": pErr.Error(),
		},
		Error: err,
	}

	return QueryError.Build(data)
}

func MakePublicQueryError(refID, err string) error {
	data := errutil.TemplateData{
		Public: map[string]any{
			"refId": refID,
			"error": err,
		},
	}
	return QueryError.Build(data)
}

type ErrorWithRefID struct {
	err   error
	refId string
}

func (ewr ErrorWithRefID) Error() string {
	return ewr.err.Error()
}

func NewErrorWithRefID(refId string, err error) error {
	ewr := ErrorWithRefID{
		err:   err,
		refId: refId,
	}
	return ewr
}
