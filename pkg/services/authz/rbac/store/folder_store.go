package store

import (
	"context"
	"fmt"
	"sync"

	"github.com/prometheus/client_golang/prometheus"
	"google.golang.org/grpc"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/pager"

	"github.com/grafana/authlib/types"

	folderv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	dashboardsearch "github.com/grafana/grafana/pkg/services/dashboards/service/search"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

const (
	metricsNamespace = "iam"
	metricsSubSystem = "authz_folder_store"
)

var (
	registerOnce sync.Once
	logger       = log.New("authz_folder_store")
	requestCount = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsSubSystem,
			Name:      "requests_total",
			Help:      "Total number of requests to the folder API server",
		},
		[]string{"status"},
	)
)

func registerMetrics(reg prometheus.Registerer) {
	registerOnce.Do(func() {
		if err := reg.Register(requestCount); err != nil {
			logger.Warn("failed to register folder store metrics", "error", err)
		}
	})
}

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

// folderSearcher is the subset of the unified-storage resource client needed to
// list folders via the search index. A lazily-resolved implementation
// (resource.EventualClient) is used to break the wiring cycle between authz and
// the resource client.
type folderSearcher interface {
	Search(ctx context.Context, in *resourcepb.ResourceSearchRequest, opts ...grpc.CallOption) (*resourcepb.ResourceSearchResponse, error)
}

func NewAPIFolderStore(tracer tracing.Tracer, reg prometheus.Registerer, configProvider func(ctx context.Context) (*rest.Config, error)) *APIFolderStore {
	registerMetrics(reg)
	return &APIFolderStore{tracer: tracer, configProvider: configProvider}
}

// WithSearcher enables listing folders via the unified-storage search index
// instead of a full object list. Search hits carry only indexed fields (UID +
// parent, no value blob), so the response is small and not subject to the
// value-byte page cap — collapsing what would otherwise be many paged
// object-list round-trips. Used behind a feature flag.
func (s *APIFolderStore) WithSearcher(searcher folderSearcher) *APIFolderStore {
	s.searcher = searcher
	return s
}

type APIFolderStore struct {
	tracer         tracing.Tracer
	configProvider func(ctx context.Context) (*rest.Config, error)
	// searcher, when set, lists folders via the search index (see WithSearcher).
	searcher folderSearcher
}

func (s *APIFolderStore) ListFolders(ctx context.Context, ns types.NamespaceInfo) ([]Folder, error) {
	ctx, span := s.tracer.Start(ctx, "authz.apistore.ListFolders")
	defer span.End()

	if s.searcher != nil {
		return s.listFoldersViaSearch(ctx, ns)
	}
	return s.listFoldersViaList(ctx, ns)
}

// listFoldersViaSearch lists folder references (UID + parent) from the search
// index in a single call. Hits carry only indexed fields (no value blob), so
// the response is not subject to the object-list byte page cap that forces
// listFoldersViaList into many paged round-trips. Both paths run as the
// Grafana service identity and return every folder in the namespace — the
// folder tree is built for inherited authorization, not filtered to the
// calling user.
func (s *APIFolderStore) listFoldersViaSearch(ctx context.Context, ns types.NamespaceInfo) ([]Folder, error) {
	ctx, span := s.tracer.Start(ctx, "authz.apistore.ListFolders.search")
	defer span.End()

	gvr := folderv1.FolderResourceInfo.GroupVersionResource()
	req := &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Namespace: ns.Value,
				Group:     gvr.Group,
				Resource:  gvr.Resource,
			},
		},
	}

	// dashboardsearch.SearchAll expects a (ctx, orgID, req) search func; the
	// resource client's Search takes no orgID (the namespace identifies the
	// tenant), so adapt it.
	searchFn := func(ctx context.Context, _ int64, req *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
		return s.searcher.Search(ctx, req)
	}

	results, err := dashboardsearch.SearchAll(ctx, ns.OrgID, req, searchFn)
	if err != nil {
		requestCount.WithLabelValues("error").Inc()
		return nil, fmt.Errorf("searching folders: %w", err)
	}
	requestCount.WithLabelValues("success").Inc()

	folders := make([]Folder, 0, len(results.Hits))
	for _, hit := range results.Hits {
		f := Folder{UID: hit.Name}
		// hit.Folder is the parent reference; the root/general folder is not a
		// real tree node, so treat it as no parent (matching the object-list path,
		// where root folders report an empty parent).
		if parent := hit.Folder; parent != "" && parent != accesscontrol.GeneralFolderUID {
			f.ParentUID = &parent
		}
		folders = append(folders, f)
	}
	return folders, nil
}

func (s *APIFolderStore) listFoldersViaList(ctx context.Context, ns types.NamespaceInfo) ([]Folder, error) {
	client, err := s.client(ctx, ns.Value)
	if err != nil {
		return nil, fmt.Errorf("create resource client: %w", err)
	}

	p := pager.New(func(ctx context.Context, opts metav1.ListOptions) (runtime.Object, error) {
		obj, err := client.List(ctx, opts)
		if err != nil {
			requestCount.WithLabelValues("error").Inc()
		} else {
			requestCount.WithLabelValues("success").Inc()
		}
		return obj, err
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
