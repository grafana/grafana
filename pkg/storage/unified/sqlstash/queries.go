package sqlstash

import (
	"context"
	"database/sql"
	"embed"
	"errors"
	"fmt"
	"strings"
	"text/template"

	"github.com/grafana/grafana/pkg/services/store/entity/db"
	"github.com/grafana/grafana/pkg/services/store/entity/sqlstash/sqltemplate"
)

// Templates setup.
var (
	//go:embed data/*.sql
	sqlTemplatesFS embed.FS

	// all templates
	helpers = template.FuncMap{
		"listSep": helperListSep,
		"join":    helperJoin,
	}
	sqlTemplates = template.Must(template.New("sql").Funcs(helpers).ParseFS(sqlTemplatesFS, `data/*.sql`))
)

func mustTemplate(filename string) *template.Template {
	if t := sqlTemplates.Lookup(filename); t != nil {
		return t
	}
	panic(fmt.Sprintf("template file not found: %s", filename))
}

// Templates.
var (
	sqlResourceVersionGet    = mustTemplate("rv_get.sql")
	sqlResourceVersionInc    = mustTemplate("rv_inc.sql")
	sqlResourceVersionInsert = mustTemplate("rv_insert.sql")
	sqlResourceVersionLock   = mustTemplate("rv_lock.sql")

	sqlResourceInsert = mustTemplate("resource_insert.sql")
	sqlResourceGet    = mustTemplate("resource_get.sql")
)

// TxOptions.
var (
	ReadCommitted = &sql.TxOptions{
		Isolation: sql.LevelReadCommitted,
	}
	ReadCommittedRO = &sql.TxOptions{
		Isolation: sql.LevelReadCommitted,
		ReadOnly:  true,
	}
)

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
		"destination arguments: %v", e.TemplateName, e.CallType,
		len(e.arguments), len(e.ScanDest), e.Err)
}

//------------------------------------------------------------------------
// Resource Version table support
//------------------------------------------------------------------------

type returnsResourceVersion struct {
	ResourceVersion int64
}

func (r *returnsResourceVersion) Results() (*returnsResourceVersion, error) {
	return r, nil
}

type sqlResourceVersionGetRequest struct {
	*sqltemplate.SQLTemplate
	Group    string
	Resource string
	*returnsResourceVersion
}

func (r sqlResourceVersionGetRequest) Validate() error {
	return nil // TODO
}

type sqlResourceVersionLockRequest struct {
	*sqltemplate.SQLTemplate
	Group    string
	Resource string
	*returnsResourceVersion
}

func (r sqlResourceVersionLockRequest) Validate() error {
	return nil // TODO
}

type sqlResourceVersionIncRequest struct {
	*sqltemplate.SQLTemplate
	Group           string
	Resource        string
	ResourceVersion int64
}

func (r sqlResourceVersionIncRequest) Validate() error {
	return nil // TODO
}

type sqlResourceVersionInsertRequest struct {
	*sqltemplate.SQLTemplate
	Group    string
	Resource string
}

func (r sqlResourceVersionInsertRequest) Validate() error {
	return nil // TODO
}

// resourceVersionAtomicInc atomically increases the version of a kind within a
// transaction.
func resourceVersionAtomicInc(ctx context.Context, x db.ContextExecer, d sqltemplate.Dialect, group, resource string) (newVersion int64, err error) {
	// 1. Lock the kind and get the latest version
	lockReq := sqlResourceVersionLockRequest{
		SQLTemplate:            sqltemplate.New(d),
		Group:                  group,
		Resource:               resource,
		returnsResourceVersion: new(returnsResourceVersion),
	}
	kindv, err := queryRow(ctx, x, sqlResourceVersionLock, lockReq)

	// if there wasn't a row associated with the given kind, we create one with
	// version 1
	if errors.Is(err, sql.ErrNoRows) {
		// NOTE: there is a marginal chance that we race with another writer
		// trying to create the same row. This is only possible when onboarding
		// a new (Group, Resource) to the cell, which should be very unlikely,
		// and the workaround is simply retrying. The alternative would be to
		// use INSERT ... ON CONFLICT DO UPDATE ..., but that creates a
		// requirement for support in Dialect only for this marginal case, and
		// we would rather keep Dialect as small as possible. Another
		// alternative is to simply check if the INSERT returns a DUPLICATE KEY
		// error and then retry the original SELECT, but that also adds some
		// complexity to the code. That would be preferrable to changing
		// Dialect, though. The current alternative, just retrying, seems to be
		// enough for now.
		insReq := sqlResourceVersionInsertRequest{
			SQLTemplate: sqltemplate.New(d),
			Group:       group,
			Resource:    resource,
		}
		if _, err = exec(ctx, x, sqlResourceVersionInsert, insReq); err != nil {
			return 0, fmt.Errorf("insert into kind_version: %w", err)
		}

		return 1, nil
	}

	if err != nil {
		return 0, fmt.Errorf("lock kind: %w", err)
	}

	incReq := sqlResourceVersionIncRequest{
		SQLTemplate:     sqltemplate.New(d),
		Group:           group,
		Resource:        resource,
		ResourceVersion: kindv.ResourceVersion,
	}
	if _, err = exec(ctx, x, sqlResourceVersionInc, incReq); err != nil {
		return 0, fmt.Errorf("increase kind version: %w", err)
	}

	return kindv.ResourceVersion + 1, nil
}

// Template helpers.

// helperListSep is a helper that helps writing simpler loops in SQL templates.
// Example usage:
//
//	{{ $comma := listSep ", "  }}
//	{{ range .Values }}
//		{{/* here we put "-" on each end to remove extra white space */}}
//		{{- call $comma -}}
//		{{ .Value }}
//	{{ end }}
func helperListSep(sep string) func() string {
	var addSep bool

	return func() string {
		if addSep {
			return sep
		}
		addSep = true

		return ""
	}
}

func helperJoin(sep string, elems ...string) string {
	return strings.Join(elems, sep)
}
