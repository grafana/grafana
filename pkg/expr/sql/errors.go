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

// CategorizedError is an Error with a Category string for use with metrics, logs, and traces.
type CategorizedError interface {
	error
	Category() string
}

// ErrorWithCategory is a concrete implementation of CategorizedError that holds an error and its category.
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

const sseErrBase = "sse.sql."

const ErrCategoryInputLimitExceeded = "input_limit_exceeded"

var inputLimitExceededStr = "sql expression [{{ .Public.refId }}] was not run because the number of input cells (columns*rows) to the sql expression exceeded the configured limit of {{ .Public.inputLimit }}"

var InputLimitExceededError = errutil.NewBase(
	errutil.StatusBadRequest, sseErrBase+ErrCategoryInputLimitExceeded).MustTemplate(
	inputLimitExceededStr,
	errutil.WithPublic(inputLimitExceededStr))

func MakeInputLimitExceededError(refID string, inputLimit int64) CategorizedError {
	data := errutil.TemplateData{
		Public: map[string]interface{}{
			"refId":      refID,
			"inputLimit": inputLimit,
		},
	}

	return &ErrorWithCategory{category: ErrCategoryInputLimitExceeded, err: InputLimitExceededError.Build(data)}
}

var duplicateStringColumnErrorStr = "sql expression [{{ .Public.refId }}] failed because it returned duplicate values across the string columns, which is not allowed for alerting. Examples: ({{ .Public.examples }}). Hint: use GROUP BY or aggregation (e.g. MAX(), AVG()) to return one row per unique combination."

var DuplicateStringColumnError = errutil.NewBase(
	errutil.StatusBadRequest, sseErrBase+ErrCategoryDuplicateStringColumns).MustTemplate(
	inputLimitExceededStr,
	errutil.WithPublic(duplicateStringColumnErrorStr),
)

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

// MakeGMSError creates a GoMySQLServerError with the given refID and error.
// It also used to wrap GMS errors into a GeneralGMSError or specific CategorizedError.
func MakeGMSError(refID string, err error) error {
	err = WrapGoMySQLServerError(refID, err)

	gmsError := &GoMySQLServerError{}
	if errors.As(err, &gmsError) {
		return MakeGeneralGMSError(gmsError, refID)
	}

	return err
}

const ErrCategoryGMSFunctionNotFound = "gms_function_not_found"
const ErrCategoryGMSTableNotFound = "gms_table_not_found"

// WrapGoMySQLServerError wraps errors from Go MySQL Server with additional context
// and a category.
func WrapGoMySQLServerError(refID string, err error) error {
	// Don't wrap nil errors
	if err == nil {
		return nil
	}

	switch {
	case mysql.ErrFunctionNotFound.Is(err):
		return &GoMySQLServerError{err: err, category: ErrCategoryGMSFunctionNotFound}
	case mysql.ErrTableNotFound.Is(err):
		// This is different from the TableNotFoundError, which is used when the engine can't find the dependency before it gets to the SQL engine.
		return &GoMySQLServerError{err: err, category: ErrCategoryGMSTableNotFound}
	case mysql.ErrColumnNotFound.Is(err):
		return MakeColumnNotFoundError(refID, err)
	default:
		// For all other errors, wrap them as a general GMS error
		return MakeGeneralGMSError(&GoMySQLServerError{
			err:      err,
			category: ErrCategoryGeneralGMSError,
		}, refID)
	}
}

const ErrCategoryGeneralGMSError = "general_gms_error"

var generalGMSErrorStr = "sql expression failed due to error from the sql expression engine: {{ .Error }}"

var GeneralGMSError = errutil.NewBase(
	errutil.StatusBadRequest, sseErrBase+ErrCategoryGeneralGMSError).MustTemplate(
	generalGMSErrorStr,
	errutil.WithPublic(generalGMSErrorStr))

// MakeGeneralGMSError is for errors returned from the GMS engine that we have not make a more specific error for.
func MakeGeneralGMSError(err *GoMySQLServerError, refID string) CategorizedError {
	data := errutil.TemplateData{
		Public: map[string]interface{}{
			"refId": refID,
		},
		Error: err,
	}

	return &ErrorWithCategory{category: err.Category(), err: GeneralGMSError.Build(data)}
}

const ErrCategoryDuplicateStringColumns = "duplicate_string_columns"

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
		category: ErrCategoryDuplicateStringColumns,
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

const ErrCategoryTimeout = "timeout"

var timeoutStr = "sql expression [{{ .Public.refId }}] timed out after {{ .Public.timeout }}"

var TimeoutError = errutil.NewBase(
	errutil.StatusTimeout, sseErrBase+ErrCategoryTimeout).MustTemplate(
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

	return &ErrorWithCategory{category: ErrCategoryTimeout, err: TimeoutError.Build(data)}
}

var ErrCategoryCancelled = "cancelled"

var cancelStr = "sql expression [{{ .Public.refId }}] was cancelled before completion"

var CancelError = errutil.NewBase(
	errutil.StatusClientClosedRequest, sseErrBase+ErrCategoryCancelled).MustTemplate(
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

	return &ErrorWithCategory{category: ErrCategoryCancelled, err: CancelError.Build(data)}
}

var ErrCategoryTableNotFound = "table_not_found"

var tableNotFoundStr = "failed to run sql expression [{{ .Public.refId }}] because it selects from table (refId/query) [{{ .Public.table }}] and that table was not found"

var TableNotFoundError = errutil.NewBase(
	errutil.StatusBadRequest, sseErrBase+ErrCategoryTableNotFound).MustTemplate(
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

	return &ErrorWithCategory{category: ErrCategoryTableNotFound, err: TableNotFoundError.Build(data)}
}

const ErrCategoryDependency = "failed_dependency"

var sqlDepErrStr = "could not run sql expression [{{ .Public.refId }}] because it selects from the results of query [{{.Public.depRefId }}] which has an error"

var DependencyError = errutil.NewBase(
	errutil.StatusBadRequest, sseErrBase+ErrCategoryDependency).MustTemplate(
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

	return &ErrorWithCategory{category: ErrCategoryDependency, err: DependencyError.Build(data)}
}

const ErrCategoryInputConversion = "input_conversion"

var sqlInputConvertErrorStr = "failed to convert the results of query [{{.Public.refId}}] (Datasource Type: [{{.Public.dsType}}]) into a SQL/Tabular format for sql expression {{ .Public.forRefID }}: {{ .Error }}"

var InputConvertError = errutil.NewBase(
	errutil.StatusBadRequest, sseErrBase+ErrCategoryInputConversion).MustTemplate(
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

	return &ErrorWithCategory{category: ErrCategoryInputConversion, err: InputConvertError.Build(data)}
}

const ErrCategoryEmptyQuery = "empty_query"

var errEmptyQueryString = "sql expression [{{.Public.refId}}] failed because it has an empty SQL query"

var ErrEmptySQLQuery = errutil.NewBase(
	errutil.StatusBadRequest, sseErrBase+ErrCategoryEmptyQuery).MustTemplate(
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

	return &ErrorWithCategory{category: ErrCategoryEmptyQuery, err: ErrEmptySQLQuery.Build(data)}
}

const ErrCategoryInvalidQuery = "invalid_query"

var invalidQueryStr = "sql expression [{{.Public.refId}}] failed because it has an invalid SQL query: {{ .Public.error }}"

var ErrInvalidQuery = errutil.NewBase(
	errutil.StatusBadRequest, sseErrBase+ErrCategoryInvalidQuery).MustTemplate(
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

	return &ErrorWithCategory{category: ErrCategoryInvalidQuery, err: ErrInvalidQuery.Build(data)}
}

var ErrCategoryBlockedNodeOrFunc = "blocked_node_or_func"

var blockedNodeOrFuncStr = "did not execute the SQL expression {{.Public.refId}} because the sql {{.Public.tokenType}} '{{.Public.token}}' is not in the allowed list of {{.Public.tokenType}}s"

var BlockedNodeOrFuncError = errutil.NewBase(
	errutil.StatusBadRequest, sseErrBase+ErrCategoryBlockedNodeOrFunc).MustTemplate(
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

	return &ErrorWithCategory{category: ErrCategoryBlockedNodeOrFunc, err: BlockedNodeOrFuncError.Build(data)}
}

const ErrCategoryColumnNotFound = "column_not_found"

var columnNotFoundStr = `sql expression [{{.Public.refId}}] failed because it selects from a column (refId/query) that does not exist: {{ .Error }}.
If this happens on a previously working query, it might mean that the query has returned no data, or the resulting schema of the query has changed.`

var ColumnNotFoundError = errutil.NewBase(
	errutil.StatusBadRequest, sseErrBase+ErrCategoryColumnNotFound).MustTemplate(
	columnNotFoundStr,
	errutil.WithPublic(columnNotFoundStr))

func MakeColumnNotFoundError(refID string, err error) CategorizedError {
	data := errutil.TemplateData{
		Public: map[string]interface{}{
			"refId": refID,
		},

		Error: err,
	}

	return &ErrorWithCategory{category: ErrCategoryColumnNotFound, err: ColumnNotFoundError.Build(data)}
}
