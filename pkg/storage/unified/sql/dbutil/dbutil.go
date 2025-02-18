// Package dbutil provides utilities to perform common database operations and
// appropriate error handling.
package dbutil

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"text/template"

	"go.opentelemetry.io/otel/attribute"

	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/otel"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

const (
	otelAttrBaseKey         = "dbutil_"
	otelAttrTemplateNameKey = otelAttrBaseKey + "template"
	otelAttrDialectKey      = otelAttrBaseKey + "dialect"
)

func withOtelAttrs(ctx context.Context, tmplName, dialectName string) context.Context {
	return otel.SetAttributes(ctx,
		attribute.String(otelAttrTemplateNameKey, tmplName),
		attribute.String(otelAttrDialectKey, dialectName),
	)
}

// SQLError is an error returned by the database, which includes additionally
// debugging information about what was sent to the database.
type SQLError struct {
	Err          error
	CallType     string // either Query, QueryRow or Exec
	TemplateName string
	Query        string
	RawQuery     string
	ScanDest     []any

	// potentially regulated information is not exported and only directly
	// available for local testing and local debugging purposes, making sure it
	// is never marshaled to JSON or any other serialization.

	arguments []any
}

func (e SQLError) Unwrap() error {
	return e.Err
}

func (e SQLError) Error() string {
	return fmt.Sprintf("%s: %s with %d input arguments and %d output "+
		"destination arguments: %v; query: %s", e.TemplateName, e.CallType,
		len(e.arguments), len(e.ScanDest), e.Err, e.Query)
}

// Debug provides greater detail about the SQL error. It is defined on the same
// struct but on a test file so that the intention that its results should not
// be used in runtime code is very clear. The results could include PII or
// otherwise regulated information, hence this method is only available in
// tests, so that it can be used in local debugging only. Note that the error
// information may still be available through other means, like using the
// "reflect" package, so care must be taken not to ever expose these information
// in production.
func (e SQLError) Debug() string {
	scanDestStr := "(none)"
	if len(e.ScanDest) > 0 {
		format := "[%T" + strings.Repeat(", %T", len(e.ScanDest)-1) + "]"
		scanDestStr = fmt.Sprintf(format, e.ScanDest...)
	}

	return fmt.Sprintf("%s: %s: %v\n\tArguments (%d): %#v\n\tReturn Value "+
		"Types (%d): %s\n\tExecuted Query: %s\n\tRaw SQL Template Output: %s",
		e.TemplateName, e.CallType, e.Err, len(e.arguments), e.arguments,
		len(e.ScanDest), scanDestStr, e.Query, e.RawQuery)
}

// Debug is meant to provide greater debugging detail about certain errors. The
// returned error will either provide more detailed information or be the same
// original error, suitable only for local debugging. The details provided are
// not meant to be logged, since they could include PII or otherwise
// sensitive/confidential information. These information should only be used for
// local debugging with fake or otherwise non-regulated information.
func Debug(err error) error {
	var d interface{ Debug() string }
	if errors.As(err, &d) {
		return errors.New(d.Debug())
	}

	return err
}

// Exec uses `req` as input for a non-data returning query generated with
// `tmpl`, and executed in `x`.
func Exec(ctx context.Context, x db.ContextExecer, tmpl *template.Template, req sqltemplate.SQLTemplate) (db.Result, error) {
	if err := req.Validate(); err != nil {
		return nil, fmt.Errorf("Exec: invalid request for template %q: %w",
			tmpl.Name(), err)
	}

	rawQuery, err := sqltemplate.Execute(tmpl, req)
	if err != nil {
		return nil, fmt.Errorf("execute template: %w", err)
	}
	query := sqltemplate.FormatSQL(rawQuery)

	args := req.GetArgs()
	ctx = withOtelAttrs(ctx, tmpl.Name(), req.DialectName())
	res, err := x.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, SQLError{
			Err:          err,
			CallType:     "Exec",
			TemplateName: tmpl.Name(),
			arguments:    args,
			Query:        query,
			RawQuery:     rawQuery,
		}
	}

	return res, nil
}

// Query uses `req` as input for a single-statement, set-returning query
// generated with `tmpl`, and executed in `x`.
func QueryRows(ctx context.Context, x db.ContextExecer, tmpl *template.Template, req sqltemplate.SQLTemplate) (db.Rows, error) {
	if err := req.Validate(); err != nil {
		return nil, fmt.Errorf("Query: invalid request for template %q: %w",
			tmpl.Name(), err)
	}

	rawQuery, err := sqltemplate.Execute(tmpl, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", tmpl.Name(), err)
	}
	query := sqltemplate.FormatSQL(rawQuery)

	args := req.GetArgs()
	ctx = withOtelAttrs(ctx, tmpl.Name(), req.DialectName())
	rows, err := x.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, SQLError{
			Err:          err,
			CallType:     "Query",
			TemplateName: tmpl.Name(),
			arguments:    args,
			ScanDest:     req.GetScanDest(),
			Query:        query,
			RawQuery:     rawQuery,
		}
	}
	return rows, err
}

// Query uses `req` as input for a single-statement, set-returning query
// generated with `tmpl`, and executed in `x`. The `Results` method of `req`
// should return a deep copy since it will be used multiple times to decode each
// value. It returns an error if more than one result set is returned.
func Query[T any](ctx context.Context, x db.ContextExecer, tmpl *template.Template, req sqltemplate.WithResults[T]) ([]T, error) {
	rows, err := QueryRows(ctx, x, tmpl, req)
	if err != nil {
		return nil, err
	}

	defer func() {
		_ = rows.Close()
	}()

	var ret []T
	for rows.Next() {
		v, err := scanRow(rows, req)
		if err != nil {
			return nil, fmt.Errorf("scan value #%d: %w", len(ret)+1, err)
		}
		ret = append(ret, v)
	}

	discardedResultSets, err := DiscardRows(rows)
	if err != nil {
		return nil, fmt.Errorf("closing rows: %w", err)
	}
	if discardedResultSets > 1 {
		return nil, fmt.Errorf("too many result sets: %v", discardedResultSets)
	}

	return ret, nil
}

// QueryRow uses `req` as input and output for a single-statement, single-row
// returning query generated with `tmpl`, and executed in `x`. It returns
// sql.ErrNoRows if no rows are returned. It also returns an error if more than
// one row or result set is returned.
func QueryRow[T any](ctx context.Context, x db.ContextExecer, tmpl *template.Template, req sqltemplate.WithResults[T]) (T, error) {
	var zero T
	res, err := Query(ctx, x, tmpl, req)
	if err != nil {
		return zero, err
	}

	switch len(res) {
	case 0:
		return zero, sql.ErrNoRows
	case 1:
		return res[0], nil
	default:
		return zero, fmt.Errorf("expecting a single row, got %d", len(res))
	}
}

// DiscardRows discards all the ResultSets in the given db.Rows and returns
// the final rows error and the number of times NextResultSet was called. This
// is useful to check for errors in queries with multiple SQL statements where
// there is no interesting output, since some drivers may omit an error returned
// by a SQL statement found in a statement that is not the first one. Note that
// not all drivers support multi-statement calls, though.
func DiscardRows(rows db.Rows) (int, error) {
	discardedResultSets := 1
	for ; rows.NextResultSet(); discardedResultSets++ {
	}
	return discardedResultSets, rows.Err()
}

type scanner interface {
	Scan(dest ...any) error
}

// scanRow is used on db.Row and db.Rows, and is factored out here not to
// improving code reuse, but rather for ease of testing.
func scanRow[T any](sc scanner, req sqltemplate.WithResults[T]) (zero T, err error) {
	if err = sc.Scan(req.GetScanDest()...); err != nil {
		return zero, fmt.Errorf("row scan: %w", err)
	}

	res, err := req.Results()
	if err != nil {
		return zero, fmt.Errorf("row results: %w", err)
	}

	return res, nil
}
