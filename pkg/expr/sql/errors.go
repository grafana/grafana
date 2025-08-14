package sql

import (
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	mysql "github.com/dolthub/go-mysql-server/sql"
	"github.com/grafana/grafana/pkg/apimachinery/errutil"
)

// GoMySQLServerError represents an error from the underlying Go MySQL Server
type GoMySQLServerError struct {
	err       error
	errorType string
}

// TypedError is an interface that allows us to categorize errors with a string that can be attached to metrics as a label, logs, and traces.
type TypedError interface {
	error
	ErrorType() string
}

// ErrorWithType is a concrete implementation of ErrorWithType that holds an error and its type.
type ErrorWithType struct {
	errorType string
	err       error
}

func (e *ErrorWithType) Error() string {
	return e.err.Error()
}

func (e *ErrorWithType) ErrorType() string {
	return e.errorType
}

// Unwrap provides the original error for errors.Is/As
func (e *ErrorWithType) Unwrap() error {
	return e.err
}

// Error implements the error interface
func (e *GoMySQLServerError) Error() string {
	return e.err.Error()
}

// Unwrap provides the original error for errors.Is/As
func (e *GoMySQLServerError) Unwrap() error {
	return e.err
}

func (e *GoMySQLServerError) ErrorType() string {
	return e.errorType
}

// WrapGoMySQLServerError wraps errors from Go MySQL Server with additional context
func WrapGoMySQLServerError(err error) error {
	// Don't wrap nil errors
	if err == nil {
		return nil
	}

	switch {
	case mysql.ErrFunctionNotFound.Is(err):
		return &GoMySQLServerError{err: err, errorType: "function_not_found"}
	case mysql.ErrTableNotFound.Is(err):
		return &GoMySQLServerError{err: err, errorType: "table_not_found"}
	case mysql.ErrColumnNotFound.Is(err):
		return &GoMySQLServerError{err: err, errorType: "column_not_found"}
	}

	// Return original error if it's not one we want to wrap
	return err
}

func MakeGMSError(refID string, err error) error {
	err = WrapGoMySQLServerError(err)

	gmsError := &GoMySQLServerError{}
	if errors.As(err, &gmsError) {
		return MakeGeneralGMSError(gmsError, refID)
	}

	return err
}

var inputLimitExceededStr = "sql expression failed to run because the input limit was exceeded for query [{{ .Public.refId }}]: {{ .Public.inputLimit }}"

var InputLimitExceededError = errutil.NewBase(
	errutil.StatusBadRequest, "sse.sql.inputLimitExceeded").MustTemplate(
	inputLimitExceededStr,
	errutil.WithPublic(inputLimitExceededStr))

func MakeInputLimitExceededError(refID string, inputLimit int64) TypedError {
	data := errutil.TemplateData{
		Public: map[string]interface{}{
			"refId":      refID,
			"inputLimit": inputLimit,
		},
	}

	return &ErrorWithType{errorType: "input_limit_exceeded", err: InputLimitExceededError.Build(data)}
}

var DuplicateStringColumnError = errutil.NewBase(
	errutil.StatusBadRequest, "sse.sql.duplicateStringColumns").MustTemplate(
	"your sql expression SQL query returned {{ .Public.count }} rows with duplicate values across the string columns, which is not allowed for alerting. Examples: ({{ .Public.examples }}). Hint: use GROUP BY or aggregation (e.g. MAX(), AVG()) to return one row per unique combination.",
	errutil.WithPublic("SQL query returned duplicate combinations of string column values. Use GROUP BY or aggregation to return one row per combination."),
)

func MakeDuplicateStringColumnError(examples []string) TypedError {
	const limit = 5
	sort.Strings(examples)
	exampleStr := strings.Join(truncateExamples(examples, limit), ", ")

	data := errutil.TemplateData{
		Public: map[string]interface{}{
			"examples": exampleStr,
			"count":    len(examples),
		},
	}

	return &ErrorWithType{
		errorType: "duplicate_string_columns",
		err:       DuplicateStringColumnError.Build(data),
	}
}

func truncateExamples(examples []string, limit int) []string {
	if len(examples) <= limit {
		return examples
	}
	truncated := examples[:limit]
	truncated = append(truncated, fmt.Sprintf("... and %d more", len(examples)-limit))
	return truncated
}

var generalGMSErrorStr = "sql expression failed due to error from the sql expression engine: {{ .Error }}"

var GeneralGMSError = errutil.NewBase(
	errutil.StatusBadRequest, "sse.sql.generalGMSError").MustTemplate(
	generalGMSErrorStr,
	errutil.WithPublic(generalGMSErrorStr))

func MakeGeneralGMSError(err *GoMySQLServerError, refID string) TypedError {
	data := errutil.TemplateData{
		Public: map[string]interface{}{
			"refId": refID,
		},
		Error: err,
	}

	return &ErrorWithType{errorType: err.ErrorType(), err: GeneralGMSError.Build(data)}
}

var timeoutStr = "sql expression [{{ .Public.refId }}] timed out after {{ .Public.timeout }}"

var TimeoutError = errutil.NewBase(
	errutil.StatusTimeout, "sse.sql.timeout").MustTemplate(
	timeoutStr,
	errutil.WithPublic(timeoutStr))

// MakeTimeOutError creates an error for when a query times out because it took longer that the configured timeout.
func MakeTimeOutError(err error, refID string, timeout time.Duration) TypedError {
	data := errutil.TemplateData{
		Public: map[string]interface{}{
			"refId":   refID,
			"timeout": timeout.String(),
		},

		Error: err,
	}

	return &ErrorWithType{errorType: "timeout", err: TimeoutError.Build(data)}
}

var cancelStr = "sql expression [{{ .Public.refId }}] was cancelled before completion"

var CancelError = errutil.NewBase(
	errutil.StatusClientClosedRequest, "sse.sql.cancel").MustTemplate(
	cancelStr,
	errutil.WithPublic(cancelStr))

// MakeCancelError creates an error for when a query is cancelled before completion.
// Users won't see this error in the browser, rather an empty response when the browser cancels the connection.
func MakeCancelError(err error, refID string) TypedError {
	data := errutil.TemplateData{
		Public: map[string]interface{}{
			"refId": refID,
		},

		Error: err,
	}

	return &ErrorWithType{errorType: "cancel", err: CancelError.Build(data)}
}

var tableNotFoundStr = "sql expression [{{ .Public.refId }}] was not run because: table (refId) '{{ .Public.table }}' not found"

var TableNotFoundError = errutil.NewBase(
	errutil.StatusBadRequest, "sse.sql.table_not_found").MustTemplate(
	tableNotFoundStr,
	errutil.WithPublic(tableNotFoundStr))

// MakeTableNotFoundError creates an error for when a referenced table
// does not exist.
func MakeTableNotFoundError(refID, table string) TypedError {
	data := errutil.TemplateData{
		Public: map[string]interface{}{
			"refId": refID,
			"table": table,
		},

		Error: fmt.Errorf("sql expression [%s] failed: table (refId)'%s' not found", refID, table),
	}

	return &ErrorWithType{errorType: "table_not_found", err: TableNotFoundError.Build(data)}
}
