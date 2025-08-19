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
	err      error
	category string
}

// CategorizedError is an interface that allows us to categorize errors with a string that can be attached to metrics, logs, and traces.
type CategorizedError interface {
	error
	Category() string
}

// ErrorWithCategory is a concrete implementation of ErrorWithCategory that holds an error and its category.
type ErrorWithCategory struct {
	category string
	err      error
}

func (e *ErrorWithCategory) Error() string {
	return e.err.Error()
}

func (e *ErrorWithCategory) Category() string {
	return e.category
}

// Unwrap provides the original error for errors.Is/As
func (e *ErrorWithCategory) Unwrap() error {
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

func (e *GoMySQLServerError) Category() string {
	return e.category
}

// WrapGoMySQLServerError wraps errors from Go MySQL Server with additional context
func WrapGoMySQLServerError(refID string, err error) error {
	// Don't wrap nil errors
	if err == nil {
		return nil
	}

	switch {
	case mysql.ErrFunctionNotFound.Is(err):
		return &GoMySQLServerError{err: err, category: "function_not_found"}
	case mysql.ErrTableNotFound.Is(err):
		return &GoMySQLServerError{err: err, category: "table_not_found"}
	case mysql.ErrColumnNotFound.Is(err):
		return MakeColumnNotFoundError(refID, err)
	}

	// Return original error if it's not one we want to wrap
	return err
}

func MakeGMSError(refID string, err error) error {
	err = WrapGoMySQLServerError(refID, err)

	gmsError := &GoMySQLServerError{}
	if errors.As(err, &gmsError) {
		return MakeGeneralGMSError(gmsError, refID)
	}

	return err
}

var inputLimitExceededStr = "sql expression [{{ .Public.refId }}] was not run because the number of input cells (columns*rows) to the sql expression exceeded the configured limit of {{ .Public.inputLimit }}"

var InputLimitExceededError = errutil.NewBase(
	errutil.StatusBadRequest, "sse.sql.inputLimitExceeded").MustTemplate(
	inputLimitExceededStr,
	errutil.WithPublic(inputLimitExceededStr))

func MakeInputLimitExceededError(refID string, inputLimit int64) CategorizedError {
	data := errutil.TemplateData{
		Public: map[string]interface{}{
			"refId":      refID,
			"inputLimit": inputLimit,
		},
	}

	return &ErrorWithCategory{category: "input_limit_exceeded", err: InputLimitExceededError.Build(data)}
}

var DuplicateStringColumnError = errutil.NewBase(
	errutil.StatusBadRequest, "sse.sql.duplicateStringColumns").MustTemplate(
	"your sql expression SQL query returned {{ .Public.count }} rows with duplicate values across the string columns, which is not allowed for alerting. Examples: ({{ .Public.examples }}). Hint: use GROUP BY or aggregation (e.g. MAX(), AVG()) to return one row per unique combination.",
	errutil.WithPublic("SQL query returned duplicate combinations of string column values. Use GROUP BY or aggregation to return one row per combination."),
)

func MakeDuplicateStringColumnError(examples []string) CategorizedError {
	const limit = 5
	sort.Strings(examples)
	exampleStr := strings.Join(truncateExamples(examples, limit), ", ")

	data := errutil.TemplateData{
		Public: map[string]interface{}{
			"examples": exampleStr,
			"count":    len(examples),
		},
	}

	return &ErrorWithCategory{
		category: "duplicate_string_columns",
		err:      DuplicateStringColumnError.Build(data),
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

func MakeGeneralGMSError(err *GoMySQLServerError, refID string) CategorizedError {
	data := errutil.TemplateData{
		Public: map[string]interface{}{
			"refId": refID,
		},
		Error: err,
	}

	return &ErrorWithCategory{category: err.Category(), err: GeneralGMSError.Build(data)}
}

var timeoutStr = "sql expression [{{ .Public.refId }}] timed out after {{ .Public.timeout }}"

var TimeoutError = errutil.NewBase(
	errutil.StatusTimeout, "sse.sql.timeout").MustTemplate(
	timeoutStr,
	errutil.WithPublic(timeoutStr))

// MakeTimeOutError creates an error for when a query times out because it took longer that the configured timeout.
func MakeTimeOutError(err error, refID string, timeout time.Duration) CategorizedError {
	data := errutil.TemplateData{
		Public: map[string]interface{}{
			"refId":   refID,
			"timeout": timeout.String(),
		},

		Error: err,
	}

	return &ErrorWithCategory{category: "timeout", err: TimeoutError.Build(data)}
}

var cancelStr = "sql expression [{{ .Public.refId }}] was cancelled before completion"

var CancelError = errutil.NewBase(
	errutil.StatusClientClosedRequest, "sse.sql.cancel").MustTemplate(
	cancelStr,
	errutil.WithPublic(cancelStr))

// MakeCancelError creates an error for when a query is cancelled before completion.
// Users won't see this error in the browser, rather an empty response when the browser cancels the connection.
func MakeCancelError(err error, refID string) CategorizedError {
	data := errutil.TemplateData{
		Public: map[string]interface{}{
			"refId": refID,
		},

		Error: err,
	}

	return &ErrorWithCategory{category: "cancel", err: CancelError.Build(data)}
}

var tableNotFoundStr = "failed to run sql expression [{{ .Public.refId }}] because it selects from table (refId/query) [{{ .Public.table }}] and that table not found"

var TableNotFoundError = errutil.NewBase(
	errutil.StatusBadRequest, "sse.sql.table_not_found").MustTemplate(
	tableNotFoundStr,
	errutil.WithPublic(tableNotFoundStr))

// MakeTableNotFoundError creates an error for when a referenced table
// does not exist.
func MakeTableNotFoundError(refID, table string) CategorizedError {
	data := errutil.TemplateData{
		Public: map[string]interface{}{
			"refId": refID,
			"table": table,
		},

		Error: fmt.Errorf("sql expression [%s] failed: table (refId)'%s' not found", refID, table),
	}

	return &ErrorWithCategory{category: "table_not_found", err: TableNotFoundError.Build(data)}
}

var sqlDepErrStr = "could not run sql expression [{{ .Public.refId }}] because it selects from the results of query [{{.Public.depRefId }}] which has an error"

var DependencyError = errutil.NewBase(
	errutil.StatusBadRequest, "sse.sql.failed_dependency").MustTemplate(
	sqlDepErrStr,
	errutil.WithPublic(sqlDepErrStr))

func MakeSQLDependencyError(refID, depRefID string) CategorizedError {
	data := errutil.TemplateData{
		Public: map[string]interface{}{
			"refId":    refID,
			"depRefId": depRefID,
		},
		Error: fmt.Errorf("could not run sql expression %v because it selects from the results of query %v which has an error", refID, depRefID),
	}

	return &ErrorWithCategory{category: "failed_dependency", err: DependencyError.Build(data)}
}

var sqlInputConvertErrorStr = "failed to convert the results of query [{{.Public.refId}}] (Datasource Type: [{{.Public.dsType}}]) into a SQL/Tabular format for sql expression {{ .Public.forRefID }}: {{ .Error }}"

var InputConvertError = errutil.NewBase(
	errutil.StatusBadRequest, "sse.sql.failed_input_conversion").MustTemplate(
	sqlInputConvertErrorStr,
	errutil.WithPublic(sqlInputConvertErrorStr))

// MakeInputConvertError creates an error for when the input conversion to a table for a SQL expressions fails.
func MakeInputConvertError(err error, refID string, forRefIDs map[string]struct{}, dsType string) CategorizedError {
	forRefIdsSlice := make([]string, 0, len(forRefIDs))
	for k := range forRefIDs {
		forRefIdsSlice = append(forRefIdsSlice, k)
	}
	data := errutil.TemplateData{
		Public: map[string]interface{}{
			"refId":    refID,
			"forRefID": forRefIdsSlice,
			"dsType":   dsType,
		},
		Error: err,
	}

	return &ErrorWithCategory{category: "input_conversion", err: InputConvertError.Build(data)}
}

var errEmptyQueryString = "sql expression [{{.Public.refId}}] failed because it has an empty SQL query"

var ErrEmptySQLQuery = errutil.NewBase(
	errutil.StatusBadRequest, "sse.sql.emptyQuery").MustTemplate(
	errEmptyQueryString,
	errutil.WithPublic(errEmptyQueryString))

// MakeTableNotFoundError creates an error for when a referenced table
// does not exist.
func MakeErrEmptyQuery(refID string) CategorizedError {
	data := errutil.TemplateData{
		Public: map[string]interface{}{
			"refId": refID,
		},

		Error: fmt.Errorf("sql expression [%s] failed because it has an empty SQL query", refID),
	}

	return &ErrorWithCategory{category: "empty_query", err: ErrEmptySQLQuery.Build(data)}
}

var invalidQueryStr = "sql expression [{{.Public.refId}}] failed because it has an invalid SQL query: {{ .Public.error }}"

var ErrInvalidQuery = errutil.NewBase(
	errutil.StatusBadRequest, "sse.sql.invalidQuery").MustTemplate(
	invalidQueryStr,
	errutil.WithPublic(invalidQueryStr))

func MakeErrInvalidQuery(refID string, err error) CategorizedError {
	data := errutil.TemplateData{
		Public: map[string]interface{}{
			"refId": refID,
			"error": err.Error(),
		},

		Error: fmt.Errorf("sql expression [%s] failed because it has an invalid SQL query: %w", refID, err),
	}

	return &ErrorWithCategory{category: "invalid_query", err: ErrInvalidQuery.Build(data)}
}

var blockedNodeOrFuncStr = "did not execute the SQL expression {{.Public.refId}} because the sql {{.Public.tokenType}} '{{.Public.token}}' is not in the allowed list of {{.Public.tokenType}}s"

var BlockedNodeOrFuncError = errutil.NewBase(
	errutil.StatusBadRequest, "sse.sql.blocked_node_or_func").MustTemplate(
	blockedNodeOrFuncStr,
	errutil.WithPublic(blockedNodeOrFuncStr))

// MakeBlockedNodeOrFuncError creates an error for when a sql function or keyword is not allowed.
func MakeBlockedNodeOrFuncError(refID, token string, isFunction bool) CategorizedError {
	tokenType := "keyword"
	if isFunction {
		tokenType = "function"
	}
	data := errutil.TemplateData{
		Public: map[string]interface{}{
			"refId":     refID,
			"token":     token,
			"tokenType": tokenType,
		},

		Error: fmt.Errorf("sql expression [%s] failed because the sql function or keyword '%s' is not in the allowed list of keywords and functions", refID, token),
	}

	return &ErrorWithCategory{category: "blocked_node_or_func", err: BlockedNodeOrFuncError.Build(data)}
}

var columnNotFoundStr = `sql expression [{{.Public.refId}}] failed because it selects from a column (refId/query) that does not exist: {{ .Error }}.
If this happens on a previously working query, it might mean that the query has returned no data, or the resulting schema of the query has changed.
`

var ColumnNotFoundError = errutil.NewBase(
	errutil.StatusBadRequest, "sse.sql.column_not_found").MustTemplate(
	columnNotFoundStr,
	errutil.WithPublic(columnNotFoundStr))

func MakeColumnNotFoundError(refID string, err error) CategorizedError {
	data := errutil.TemplateData{
		Public: map[string]interface{}{
			"refId": refID,
		},

		Error: err,
	}

	return &ErrorWithCategory{category: "column_not_found", err: ColumnNotFoundError.Build(data)}
}
