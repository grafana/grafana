package corerole

import (
	"context"
	"database/sql"
	"embed"
	"encoding/json"
	"fmt"
	"text/template"

	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

// Templates setup.
var (
	//go:embed *.sql
	sqlTemplatesFS embed.FS

	sqlTemplates = template.Must(template.New("sql").ParseFS(sqlTemplatesFS, `*.sql`))
)

func mustTemplate(filename string) *template.Template {
	if t := sqlTemplates.Lookup(filename); t != nil {
		return t
	}
	panic(fmt.Sprintf("template file not found: %s", filename))
}

type ListCoreRolesQuery struct {
	UID string

	Pagination common.Pagination
}

type ListCoreRolesResult struct {
	Roles    []accesscontrol.RoleDTO
	Continue int64
	RV       int64
}

var sqlQueryCoreRolesTemplate = mustTemplate("core_role_query.sql")

func newListCoreRoles(sql *legacysql.LegacyDatabaseHelper, q *ListCoreRolesQuery) listCoreRolesQuery {
	return listCoreRolesQuery{
		SQLTemplate:      sqltemplate.New(sql.DialectForDriver()),
		RoleTable:        sql.Table("role"),
		FixedRolePattern: sql.Table("fixed:%"),
		Query:            q,
	}
}

type listCoreRolesQuery struct {
	sqltemplate.SQLTemplate
	Query            *ListCoreRolesQuery
	RoleTable        string
	FixedRolePattern string
}

func (s *sqlResourceStorageBackend) getRows(ctx context.Context, sql *legacysql.LegacyDatabaseHelper, query *ListCoreRolesQuery) (*rowsWrapper, error) {
	req := newListCoreRoles(sql, query)
	tmpl := sqlQueryCoreRolesTemplate

	rawQuery, err := sqltemplate.Execute(tmpl, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", tmpl.Name(), err)
	}

	rows, err := sql.DB.GetSqlxSession().Query(ctx, rawQuery, req.GetArgs()...)
	if err != nil {
		if rows != nil {
			_ = rows.Close()
		}
		rows = nil
	}
	return &rowsWrapper{
		s:    s,
		rows: rows,
	}, err
}

var _ resource.ListIterator = (*rowsWrapper)(nil)

type rowsWrapper struct {
	s    *sqlResourceStorageBackend
	rows *sql.Rows

	count int

	// Current
	row *v0alpha1.CoreRole
	err error

	token continueToken

	// max 100 rejected?
	rejected []v0alpha1.CoreRole
}

func (r *rowsWrapper) Close() error {
	if r.rows != nil {
		return r.rows.Close()
	}
	return nil
}

// ContinueToken implements resource.ListIterator.
func (r *rowsWrapper) ContinueToken() string {
	return r.token.String()
}

// Error implements resource.ListIterator.
func (r *rowsWrapper) Error() error {
	return r.err
}

// Folder implements resource.ListIterator.
func (r *rowsWrapper) Folder() string {
	return ""
}

// Name implements resource.ListIterator.
func (r *rowsWrapper) Name() string {
	return r.row.Name
}

// Namespace implements resource.ListIterator.
func (r *rowsWrapper) Namespace() string {
	return ""
}

func toCoreRole(roleDTO *accesscontrol.RoleDTO) *v0alpha1.CoreRole {
	return &v0alpha1.CoreRole{
		TypeMeta: v0alpha1.CoreRoleInfo.TypeMeta(),
		ObjectMeta: metav1.ObjectMeta{
			Name:            roleDTO.UID,
			ResourceVersion: fmt.Sprintf("%d", roleDTO.Version),
		},
		Spec: v0alpha1.CoreRoleSpec{
			Title:   roleDTO.DisplayName,
			Version: roleDTO.Version,
			Group:   roleDTO.Group,
			// Description: roleDTO.Description,
			Permissions: []v0alpha1.CoreRolespecPermission{},
		},
	}
}

// Next implements resource.ListIterator.
func (r *rowsWrapper) Next() bool {
	if r.err != nil {
		return false
	}

	var err error
	for r.rows.Next() {
		r.count++

		role := accesscontrol.RoleDTO{}
		err = r.rows.Scan(&role.Version, &role.OrgID, &role.ID, &role.UID, &role.Name, &role.DisplayName,
			&role.Description, &role.Group, &role.Hidden, &role.Created, &role.Updated,
		)
		if err != nil {
			if len(r.rejected) > 1000 {
				r.err = fmt.Errorf("too many rejected rows (%d): %w", len(r.rejected), err)
				return false
			}
			r.rejected = append(r.rejected, *toCoreRole(&role))
			continue
		}

		r.token.id = role.ID
		r.row = toCoreRole(&role)
		return true
	}
	return false
}

// ResourceVersion implements resource.ListIterator.
func (r *rowsWrapper) ResourceVersion() int64 {
	return r.row.Spec.Version
}

// Value implements resource.ListIterator.
func (r *rowsWrapper) Value() []byte {
	b, err := json.Marshal(r.row)
	r.err = err
	return b
}
