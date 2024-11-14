package query

import (
	"errors"
	"fmt"

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

var depErrStr = "did not execute expression [{{ .Public.refId }}] due to a failure to of the dependent expression or query [{{.Public.depRefId}}]"

var dependencyError = errutil.BadRequest("sse.dependencyError").MustTemplate(
	depErrStr,
	errutil.WithPublic(depErrStr))

func makeDependencyError(refID, depRefID string) error {
	data := errutil.TemplateData{
		Public: map[string]interface{}{
			"refId":    refID,
			"depRefId": depRefID,
		},
		Error: fmt.Errorf("did not execute expression %v due to a failure to of the dependent expression or query %v", refID, depRefID),
	}

	return dependencyError.Build(data)
}

var cyclicErrStr = "cyclic reference in expression [{{ .Public.refId }}]"

var cyclicErr = errutil.BadRequest("sse.cyclic").MustTemplate(
	cyclicErrStr,
	errutil.WithPublic(cyclicErrStr))

func makeCyclicError(refID string) error {
	data := errutil.TemplateData{
		Public: map[string]interface{}{
			"refId": refID,
		},
		Error: fmt.Errorf("cyclic reference in %s", refID),
	}
	return cyclicErr.Build(data)
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
