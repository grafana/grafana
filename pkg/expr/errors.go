package expr

import (
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
)

var ErrSeriesMustBeWide = errors.New("input data must be a wide series")

var ConversionError = errutil.BadRequest("sse.readDataError").MustTemplate(
	"[{{ .Public.refId }}] got error: {{ .Error }}",
	errutil.WithPublic(
		"failed to read data from from query {{ .Public.refId }}: {{ .Public.error }}",
	),
)

func makeConversionError(refID string, err error) error {
	data := errutil.TemplateData{
		// Conversion errors should only have meta information in errors
		Public: map[string]any{
			"refId": refID,
			"error": err.Error(),
		},
		Error: err,
	}
	return ConversionError.Build(data)
}

var QueryError = errutil.BadRequest("sse.dataQueryError").MustTemplate(
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
		Public: map[string]any{
			"refId":         refID,
			"datasourceUID": datasourceUID,
			"error":         pErr.Error(),
		},
		Error: err,
	}

	return QueryError.Build(data)
}

var depErrStr = "did not execute expression [{{ .Public.refId }}] due to a failure of the dependent expression or query [{{.Public.depRefId}}]"

var DependencyError = errutil.NewBase(
	errutil.StatusBadRequest, "sse.dependencyError").MustTemplate(
	depErrStr,
	errutil.WithPublic(depErrStr))

func MakeDependencyError(refID, depRefID string) error {
	data := errutil.TemplateData{
		Public: map[string]interface{}{
			"refId":    refID,
			"depRefId": depRefID,
		},
		Error: fmt.Errorf("did not execute expression %v due to a failure of the dependent expression or query %v", refID, depRefID),
	}

	return DependencyError.Build(data)
}

var parsErrStr = "failed to parse expression [{{ .Public.refId }}]: {{.Public.error}}"

var ParseError = errutil.NewBase(
	errutil.StatusBadRequest, "sse.parseError").MustTemplate(
	parsErrStr,
	errutil.WithPublic(parsErrStr))

func MakeParseError(refID string, err error) error {
	data := errutil.TemplateData{
		Public: map[string]interface{}{
			"refId": refID,
			"error": err.Error(),
		},
		Error: err,
	}

	return ParseError.Build(data)
}

var unexpectedNodeTypeErrString = "expected executable node type but got node type [{{ .Public.nodeType }} for refid [{{ .Public.refId}}]"

var UnexpectedNodeTypeError = errutil.NewBase(
	errutil.StatusBadRequest, "sse.unexpectedNodeType").MustTemplate(
	unexpectedNodeTypeErrString,
	errutil.WithPublic(unexpectedNodeTypeErrString))

func makeUnexpectedNodeTypeError(refID, nodeType string) error {
	data := errutil.TemplateData{
		Public: map[string]interface{}{
			"refId":    refID,
			"nodeType": nodeType,
		},
		Error: fmt.Errorf("expected executable node type but got node type %v for refId %v", nodeType, refID),
	}

	return UnexpectedNodeTypeError.Build(data)
}
