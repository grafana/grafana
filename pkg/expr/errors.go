package expr

import (
	"errors"
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
)

var ErrSeriesMustBeWide = errors.New("input data must be a wide series")

// ErrQueryLimit marks a datasource query rejected by a Mimir query-time resource
// limit. These fail identically on every in-cycle retry, so callers can treat
// them as non-retryable via errors.Is(err, ErrQueryLimit).
var ErrQueryLimit = errors.New("query exceeded a resource limit")

// queryLimitErrorIDs are the Mimir global error IDs that ErrQueryLimit covers.
// They survive only as substrings of the datasource error, so they are matched
// here — the single place query errors are built — and surfaced as the sentinel.
var queryLimitErrorIDs = []string{
	"err-mimir-max-chunks-per-query",
	"err-mimir-max-series-per-query",
	"err-mimir-max-chunks-bytes-per-query",
	"err-mimir-max-estimated-chunks-per-query",
	"err-mimir-max-estimated-memory-consumption-per-query",
}

func isQueryLimitError(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	for _, id := range queryLimitErrorIDs {
		if strings.Contains(msg, id) {
			return true
		}
	}
	return false
}

// queryLimitError wraps a built query error so that errors.Is(err, ErrQueryLimit)
// reports true, without altering the error message or breaking the underlying
// errutil.Error chain (errors.As and Unwrap keep working).
type queryLimitError struct{ error }

func (queryLimitError) Is(target error) bool { return target == ErrQueryLimit }
func (e queryLimitError) Unwrap() error      { return e.error }

// WrapQueryLimitError tags err with ErrQueryLimit when its message contains a known
// Mimir query-limit error ID, preserving the original message and chain. Use it at
// boundaries where a query error is reconstructed from its string and the original
// error chain is lost — e.g. an error deserialized from a remote query service — so
// errors.Is(err, ErrQueryLimit) classification keeps working there too.
func WrapQueryLimitError(err error) error {
	if err == nil || !isQueryLimitError(err) {
		return err
	}
	return queryLimitError{err}
}

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

	return WrapQueryLimitError(QueryError.Build(data))
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

var missingDependentNodeErrString = "did not execute [{{ .Public.refId }}]: could not find dependent node [{{ .Public.depRefId }}]"

var MissingDependentNodeError = errutil.NewBase(
	errutil.StatusBadRequest, "sse.missingDependentNode").MustTemplate(
	missingDependentNodeErrString,
	errutil.WithPublic(missingDependentNodeErrString))

func MakeMissingDependentNodeError(refID, depRefID string) error {
	data := errutil.TemplateData{
		Public: map[string]any{
			"refId":    refID,
			"depRefId": depRefID,
		},
		Error: fmt.Errorf("did not execute %v: could not find dependent node %v", refID, depRefID),
	}

	return MissingDependentNodeError.Build(data)
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
