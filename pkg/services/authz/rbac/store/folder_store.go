package store

import (
	"context"

	"github.com/grafana/authlib/claims"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

type FolderStore interface {
	ListFolders(ctx context.Context, ns claims.NamespaceInfo) ([]Folder, error)
}

type Folder struct {
	UID       string
	ParentUID *string
}

var _ FolderStore = (*SQLFolderStore)(nil)

func NewSQLFolderStore(sql legacysql.LegacyDatabaseProvider, tracer tracing.Tracer) *SQLFolderStore {
	return &SQLFolderStore{sql, tracer}
}

type SQLFolderStore struct {
	sql    legacysql.LegacyDatabaseProvider
	tracer tracing.Tracer
}

var sqlFolders = mustTemplate("folder_query.sql")

type listFoldersQuery struct {
	sqltemplate.SQLTemplate

	Query       *FolderQuery
	FolderTable string
}

type FolderQuery struct {
	OrgID int64
}

func (r listFoldersQuery) Validate() error {
	return nil
}

func newListFolders(sql *legacysql.LegacyDatabaseHelper, query *FolderQuery) listFoldersQuery {
	return listFoldersQuery{
		SQLTemplate: sqltemplate.New(sql.DialectForDriver()),
		Query:       query,
		FolderTable: sql.Table("folder"),
	}
}

func (s *SQLFolderStore) ListFolders(ctx context.Context, ns claims.NamespaceInfo) ([]Folder, error) {
	ctx, span := s.tracer.Start(ctx, "authz_direct_db.database.ListFolders")
	defer span.End()

	sql, err := s.sql(ctx)
	if err != nil {
		return nil, err
	}

	query := newListFolders(sql, &FolderQuery{OrgID: ns.OrgID})
	q, err := sqltemplate.Execute(sqlFolders, query)
	if err != nil {
		return nil, err
	}

	rows, err := sql.DB.GetSqlxSession().Query(ctx, q, query.GetArgs()...)
	defer func() {
		if rows != nil {
			_ = rows.Close()
		}
	}()
	if err != nil {
		return nil, err
	}

	var folders []Folder
	for rows.Next() {
		var folder Folder
		if err := rows.Scan(&folder.UID, &folder.ParentUID); err != nil {
			return nil, err
		}
		folders = append(folders, folder)
	}

	return folders, nil
}
