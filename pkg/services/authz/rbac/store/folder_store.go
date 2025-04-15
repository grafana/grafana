package store

import (
	"context"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/pager"

	"github.com/grafana/authlib/types"
	folderv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
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

func NewAPIFolderStore(tracer tracing.Tracer, configProvider func(ctx context.Context) (*rest.Config, error)) *APIFolderStore {
	return &APIFolderStore{tracer, configProvider}
}

type APIFolderStore struct {
	tracer         tracing.Tracer
	configProvider func(ctx context.Context) (*rest.Config, error)
}

func (s *APIFolderStore) ListFolders(ctx context.Context, ns types.NamespaceInfo) ([]Folder, error) {
	ctx, span := s.tracer.Start(ctx, "authz.apistore.ListFolders")
	defer span.End()

	client, err := s.client(ctx, ns.Value)
	if err != nil {
		return nil, fmt.Errorf("create resource client: %w", err)
	}

	p := pager.New(func(ctx context.Context, opts metav1.ListOptions) (runtime.Object, error) {
		return client.List(ctx, opts)
	})

	const defaultPageSize = 500
	folders := make([]Folder, 0, defaultPageSize)
	err = p.EachListItem(ctx, metav1.ListOptions{Limit: defaultPageSize}, func(obj runtime.Object) error {
		object, err := utils.MetaAccessor(obj)
		if err != nil {
			return err
		}

		folder := Folder{UID: object.GetName()}
		parent := object.GetFolder()
		if parent != "" {
			folder.ParentUID = &parent
		}

		folders = append(folders, folder)
		return nil
	})

	if err != nil {
		return nil, fmt.Errorf("fetching folders: %w", err)
	}

	return folders, nil
}

func (s *APIFolderStore) client(ctx context.Context, namespace string) (dynamic.ResourceInterface, error) {
	cfg, err := s.configProvider(ctx)
	if err != nil {
		return nil, err
	}
	client, err := dynamic.NewForConfig(cfg)
	if err != nil {
		return nil, err
	}
	return client.Resource(folderv1.FolderResourceInfo.GroupVersionResource()).Namespace(namespace), nil
}
