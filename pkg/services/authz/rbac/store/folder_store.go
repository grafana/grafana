package store

import (
	"context"
	"fmt"

	"github.com/grafana/authlib/types"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	folderv0 "github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

type FolderStore interface {
	ListFolders(ctx context.Context, ns types.NamespaceInfo) ([]Folder, error)
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

func (s *SQLFolderStore) ListFolders(ctx context.Context, ns types.NamespaceInfo) ([]Folder, error) {
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

var _ FolderStore = (*APIFolderStore)(nil)

func NewAPIFolderStore(tracer tracing.Tracer, configProvider func(ctx context.Context) *rest.Config) *APIFolderStore {
	return &APIFolderStore{tracer, configProvider}
}

type APIFolderStore struct {
	tracer         tracing.Tracer
	configProvider func(ctx context.Context) *rest.Config
}

func (s *APIFolderStore) ListFolders(ctx context.Context, ns types.NamespaceInfo) ([]Folder, error) {
	ctx, span := s.tracer.Start(ctx, "authz.apistore.ListFolders")
	defer span.End()

	client, err := s.client(ctx, ns.Value)
	if err != nil {
		return nil, fmt.Errorf("create resource client: %w", err)
	}
	list := func(c string) ([]Folder, string, error) {
		list, err := client.List(ctx, metav1.ListOptions{
			// We should figure out a good limit
			Limit:    1000,
			Continue: c,
		})

		if err != nil {
			return nil, "", err
		}

		folders := make([]Folder, 0, len(list.Items))
		for _, i := range list.Items {
			object, err := utils.MetaAccessor(&i)
			if err != nil {
				return nil, "", err
			}

			folder := Folder{UID: object.GetName()}
			parent := object.GetFolder()
			if parent != "" {
				folder.ParentUID = &parent
			}

			folders = append(folders, folder)
		}

		return folders, list.GetContinue(), nil
	}

	// initial request list
	folders, c, err := list("")
	if err != nil {
		return nil, err
	}

	// as long as we have a continue token we keep calling the api
	for c != "" {
		var (
			c     string
			err   error
			items []Folder
		)

		items, c, err = list(c)
		if err != nil {
			return nil, err
		}

		folders = append(folders, items...)
	}

	return folders, nil
}

func (s *APIFolderStore) client(ctx context.Context, namespace string) (dynamic.ResourceInterface, error) {
	client, err := dynamic.NewForConfig(s.configProvider(ctx))
	if err != nil {
		return nil, err
	}
	return client.Resource(folderv0.FolderResourceInfo.GroupVersionResource()).Namespace(namespace), nil
}
