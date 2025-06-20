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

type listCoreRolesQuery struct {
	sqltemplate.SQLTemplate
	Query            *ListCoreRolesQuery
	RoleTable        string
	FixedRolePattern string
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

func (s *sqlResourceStorageBackend) getIterator(ctx context.Context, sql *legacysql.LegacyDatabaseHelper, query *ListCoreRolesQuery) (*listIterator, error) {
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
	return &listIterator{
		s:    s,
		rows: rows,
	}, err
}

var _ resource.ListIterator = (*listIterator)(nil)

type listIterator struct {
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

func (r *listIterator) Close() error {
	if r.rows != nil {
		return r.rows.Close()
	}
	return nil
}

// ContinueToken implements resource.ListIterator.
func (r *listIterator) ContinueToken() string {
	return r.token.String()
}

// Error implements resource.ListIterator.
func (r *listIterator) Error() error {
	return r.err
}

// Folder implements resource.ListIterator.
func (r *listIterator) Folder() string {
	return ""
}

// Name implements resource.ListIterator.
func (r *listIterator) Name() string {
	return r.row.Name
}

// Namespace implements resource.ListIterator.
func (r *listIterator) Namespace() string {
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
func (r *listIterator) Next() bool {
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
func (r *listIterator) ResourceVersion() int64 {
	return r.row.Spec.Version
}

// Value implements resource.ListIterator.
func (r *listIterator) Value() []byte {
	b, err := json.Marshal(r.row)
	r.err = err
	return b
}

type ListCoreRolePermissionsQuery struct {
	RoleIDs []int64
}

type listCoreRolePermissionsQuery struct {
	sqltemplate.SQLTemplate
	Query           *ListCoreRolePermissionsQuery
	PermissionTable string
}

var sqlQueryCoreRolePermissionsTemplate = mustTemplate("core_role_permissions_query.sql")

func newListCoreRolePermissions(sql *legacysql.LegacyDatabaseHelper, q *ListCoreRolePermissionsQuery) listCoreRolePermissionsQuery {
	return listCoreRolePermissionsQuery{
		SQLTemplate:     sqltemplate.New(sql.DialectForDriver()),
		PermissionTable: sql.Table("permission"),
		Query:           q,
	}
}

type rolePermission struct {
	roleID int64
	action string
	scope  string
}

func (rp rolePermission) toCoreRolePermission() v0alpha1.CoreRolespecPermission {
	return v0alpha1.CoreRolespecPermission{
		Action: rp.action,
		Scope:  rp.scope,
	}
}

func (s *sqlResourceStorageBackend) getCoreRole(ctx context.Context, sql *legacysql.LegacyDatabaseHelper, name string) (*v0alpha1.CoreRole, error) {
	query := &ListCoreRolesQuery{
		UID: name,
		Pagination: common.Pagination{
			Limit:    1, // We only want one
			Continue: 0, // No continuation token
		},
	}

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
		return nil, fmt.Errorf("querying core roles: %w", err)
	}
	defer func() {
		_ = rows.Close()
	}()
	if !rows.Next() {
		return nil, fmt.Errorf("core role %q not found", name)
	}

	role := accesscontrol.RoleDTO{}
	if err := rows.Scan(&role.Version, &role.OrgID, &role.ID, &role.UID, &role.Name, &role.DisplayName,
		&role.Description, &role.Group, &role.Hidden, &role.Created, &role.Updated,
	); err != nil {
		return nil, fmt.Errorf("scanning core role %q: %w", name, err)
	}
	coreRole := toCoreRole(&role)

	reqP := newListCoreRolePermissions(sql, &ListCoreRolePermissionsQuery{[]int64{role.ID}})
	tmplP := sqlQueryCoreRolePermissionsTemplate

	rawQueryP, err := sqltemplate.Execute(tmplP, reqP)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", tmplP.Name(), err)
	}
	rowsP, err := sql.DB.GetSqlxSession().Query(ctx, rawQueryP, reqP.GetArgs()...)
	if err != nil {
		if rowsP != nil {
			_ = rowsP.Close()
		}
		return nil, fmt.Errorf("querying core role permissions for %q: %w", name, err)
	}
	defer func() {
		_ = rowsP.Close()
	}()
	permissions := []v0alpha1.CoreRolespecPermission{}
	for rowsP.Next() {
		var perm rolePermission
		if err := rowsP.Scan(&perm.roleID, &perm.action, &perm.scope); err != nil {
			return nil, fmt.Errorf("scanning core role permissions for %q: %w", name, err)
		}
		permissions = append(permissions, perm.toCoreRolePermission())
	}
	coreRole.Spec.Permissions = permissions
	return coreRole, nil
}
