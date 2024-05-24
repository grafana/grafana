package sqlstash

import (
	"context"
	"crypto/md5"
	"database/sql"
	"encoding/hex"
	"fmt"
	"text/template"

	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/services/store"
	"github.com/grafana/grafana/pkg/services/store/entity/db"
	"github.com/grafana/grafana/pkg/services/store/entity/sqlstash/sqltemplate"
)

func createETag(body []byte, meta []byte, status []byte) string {
	h := md5.New()
	_, _ = h.Write(meta)
	_, _ = h.Write(body)
	_, _ = h.Write(status)
	hash := h.Sum(nil)
	return hex.EncodeToString(hash[:])
}

// getCurrentUser returns a string identifying the user making a request with
// the given context.
func getCurrentUser(ctx context.Context) (string, error) {
	user, err := appcontext.User(ctx)
	if err != nil || user == nil {
		return "", fmt.Errorf("%w: %w", ErrUserNotFoundInContext, err)
	}

	return store.GetUserIDString(user), nil
}

// ptrOr returns the first non-nil pointer in the least or a new non-nil
// pointer.
func ptrOr[P ~*E, E any](ps ...P) P {
	for _, p := range ps {
		if p != nil {
			return p
		}
	}

	return P(new(E))
}

// sliceOr returns the first slice that has at least one element, or a non-nil
// empty slice.
func sliceOr[S ~[]E, E comparable](vals ...S) S {
	for _, s := range vals {
		if len(s) > 0 {
			return s
		}
	}

	return S{}
}

// mapOr returns the first map that has at least one element, or a non-nil empty
// map.
func mapOr[M ~map[K]V, K comparable, V any](vals ...M) M {
	for _, m := range vals {
		if len(m) > 0 {
			return m
		}
	}

	return M{}
}

// countTrue returns the number of true values in its arguments.
func countTrue(bools ...bool) uint64 {
	var ret uint64
	for _, b := range bools {
		if b {
			ret++
		}
	}

	return ret
}

// query uses `req` as input and output for a zero or more row-returning query
// generated with `tmpl`, and executed in `x`.
func query[T any](ctx context.Context, x db.ContextExecer, tmpl *template.Template, req sqltemplate.WithResults[T]) ([]T, error) {
	query, err := sqltemplate.Execute(tmpl, req)
	if err != nil {
		return nil, fmt.Errorf("execute template: %w", err)
	}

	args := req.GetArgs()
	rows, err := x.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, SQLError{
			Err:       err,
			CallType:  "Query",
			Arguments: args,
			Query:     query,
		}
	}
	defer rows.Close() //nolint:errcheck

	var ret []T
	for rows.Next() {
		res, err := scanRow(rows, req)
		if err != nil {
			return nil, err
		}
		ret = append(ret, res)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows err: %w", err)
	}

	return ret, nil
}

// queryRow uses `req` as input and output for a single-row returning query
// generated with `tmpl`, and executed in `x`.
func queryRow[T any](ctx context.Context, x db.ContextExecer, tmpl *template.Template, req sqltemplate.WithResults[T]) (T, error) {
	var zero T

	query, err := sqltemplate.Execute(tmpl, req)
	if err != nil {
		return zero, fmt.Errorf("execute template: %w", err)
	}

	args := req.GetArgs()
	row := x.QueryRowContext(ctx, query, args...)
	if err := row.Err(); err != nil {
		return zero, SQLError{
			Err:       err,
			CallType:  "Exec",
			Arguments: args,
			Query:     query,
		}
	}

	return scanRow(row, req)
}

type scanner interface {
	Scan(dest ...any) error
}

// scanRow is used on *sql.Row and *sql.Rows, and is factored out here not to
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

// exec uses `req` as input for a non-data returning query generated with
// `tmpl`, and executed in `x`.
func exec(ctx context.Context, x db.ContextExecer, tmpl *template.Template, req sqltemplate.SQLTemplateIface) (sql.Result, error) {
	query, err := sqltemplate.Execute(tmpl, req)
	if err != nil {
		return nil, fmt.Errorf("execute template: %w", err)
	}

	args := req.GetArgs()
	res, err := x.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, SQLError{
			Err:       err,
			CallType:  "Exec",
			Arguments: args,
			Query:     query,
		}
	}

	return res, nil
}
