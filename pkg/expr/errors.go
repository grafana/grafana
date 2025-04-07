package expr

import (
	"errors"
	"fmt"
	"sort"
	"strings"

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

var depErrStr = "did not execute expression [{{ .Public.refId }}] due to a failure to of the dependent expression or query [{{.Public.depRefId}}]"

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
		Error: fmt.Errorf("did not execute expression %v due to a failure to of the dependent expression or query %v", refID, depRefID),
	}

	return DependencyError.Build(data)
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

var DuplicateStringColumnError = errutil.NewBase(
	errutil.StatusBadRequest, "sse.duplicateStringColumns").MustTemplate(
	"your SQL query returned {{ .Public.count }} rows with duplicate values across the string columns, which is not allowed for alerting. Examples: ({{ .Public.examples }}). Hint: use GROUP BY or aggregation (e.g. MAX(), AVG()) to return one row per unique combination.",
	errutil.WithPublic("SQL query returned duplicate combinations of string column values. Use GROUP BY or aggregation to return one row per combination."),
)

func makeDuplicateStringColumnError(examples []string) error {
	const limit = 5
	sort.Strings(examples)
	exampleStr := strings.Join(truncateExamples(examples, limit), ", ")

	return DuplicateStringColumnError.Build(errutil.TemplateData{
		Public: map[string]any{
			"examples": exampleStr,
			"count":    len(examples),
		},
	})
}

func truncateExamples(examples []string, limit int) []string {
	if len(examples) <= limit {
		return examples
	}
	truncated := examples[:limit]
	truncated = append(truncated, fmt.Sprintf("... and %d more", len(examples)-limit))
	return truncated
}
