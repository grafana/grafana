package query

import (
	"context"
	"errors"
	"fmt"
	"sort"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry/apis/datasource/converter"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
)

// DataSourceCollectionResource is the unified storage collection that holds every datasource
// type, and the resource whose storage mode decides where datasources are read from.
var DataSourceCollectionResource = schema.GroupResource{
	Group:    datasourceV0.GROUP,
	Resource: datasourceV0.DataSourceResourceInfo.GetName(),
}

var errExpectedDataSource = errors.New("expected a datasource")

// annotationPageSize bounds each read of the collection when annotations are merged in.
const annotationPageSize = 500

// maxLegacyDataSources matches the connections listing, which also loads the whole table.
const maxLegacyDataSources = 10000

var (
	_ rest.Scoper               = (*datasourcesStore)(nil)
	_ rest.SingularNameProvider = (*datasourcesStore)(nil)
	_ rest.Getter               = (*datasourcesStore)(nil)
	_ rest.Lister               = (*datasourcesStore)(nil)
	_ rest.Storage              = (*datasourcesStore)(nil)
)

type unifiedDataSources interface {
	rest.Getter
	rest.Lister
}

type legacyDataSources interface {
	GetDataSources(ctx context.Context, query *datasources.GetDataSourcesQuery) ([]*datasources.DataSource, error)
	GetDataSource(ctx context.Context, query *datasources.GetDataSourceQuery) (*datasources.DataSource, error)
}

// datasourcesStore serves every datasource type through one read-only resource, from the
// collection or the table depending on the storage mode. The table has no annotations or labels, so
// below unified mode they are taken from the collection.
type datasourcesStore struct {
	resourceInfo   utils.ResourceInfo
	tableConverter rest.TableConvertor
	unified        unifiedDataSources
	legacy         legacyDataSources
	status         dualwrite.Service
	ac             accesscontrol.AccessControl
	mapper         request.NamespaceMapper
	logger         log.Logger
}

func (s *datasourcesStore) New() runtime.Object {
	return s.resourceInfo.NewFunc()
}

func (s *datasourcesStore) Destroy() {}

func (s *datasourcesStore) NamespaceScoped() bool {
	return true
}

func (s *datasourcesStore) GetSingularName() string {
	return s.resourceInfo.GetSingularName()
}

func (s *datasourcesStore) ShortNames() []string {
	return s.resourceInfo.GetShortNames()
}

func (s *datasourcesStore) NewList() runtime.Object {
	return s.resourceInfo.NewListFunc()
}

func (s *datasourcesStore) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

// mode reports where datasources are read from. The table is what every deployment that has not
// migrated needs, so it wins when the mode cannot be read.
func (s *datasourcesStore) mode(ctx context.Context) dualwrite.StorageStatus {
	status, err := s.status.Status(ctx, DataSourceCollectionResource)
	if err != nil {
		s.logger.Warn("could not read the data source storage mode, reading from legacy", "error", err)
		return dualwrite.StorageStatus{WriteLegacy: true}
	}
	return status
}

func (s *datasourcesStore) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	status := s.mode(ctx)
	if status.ReadUnified {
		obj, err := s.unified.Get(ctx, name, options)
		if err != nil {
			return nil, err
		}
		if !s.canRead(ctx, user, name) {
			return nil, apierrors.NewNotFound(s.resourceInfo.GroupResource(), name)
		}
		if ds, ok := obj.(*dataSourceMetadata); ok {
			ds.pointAtServingGroup()
		}
		return obj, nil
	}

	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	found, err := s.legacy.GetDataSource(ctx, &datasources.GetDataSourceQuery{OrgID: info.OrgID, UID: name})
	if err != nil {
		if errors.Is(err, datasources.ErrDataSourceNotFound) {
			return nil, apierrors.NewNotFound(s.resourceInfo.GroupResource(), name)
		}
		return nil, err
	}
	if !s.canRead(ctx, user, found.UID) {
		return nil, apierrors.NewNotFound(s.resourceInfo.GroupResource(), name)
	}

	ds, err := s.asDataSource(found)
	if err != nil {
		return nil, err
	}
	if status.WriteUnified {
		if stored, err := s.unified.Get(ctx, name, options); err == nil {
			mergeStoredMeta(ds, stored)
		} else if !apierrors.IsNotFound(err) {
			s.logger.Warn("could not read the stored data source metadata", "name", name, "error", err)
		}
	}
	return ds, nil
}

func (s *datasourcesStore) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	status := s.mode(ctx)
	if status.ReadUnified {
		return s.listUnified(ctx, user, options)
	}

	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	found, err := s.legacy.GetDataSources(ctx, &datasources.GetDataSourcesQuery{
		OrgID:           info.OrgID,
		DataSourceLimit: maxLegacyDataSources,
	})
	if err != nil {
		return nil, err
	}
	sort.Slice(found, func(i, j int) bool { return found[i].UID < found[j].UID })

	items := make([]dataSourceMetadata, 0, len(found))
	for _, legacy := range found {
		if !s.canRead(ctx, user, legacy.UID) {
			continue
		}
		ds, err := s.asDataSource(legacy)
		if err != nil {
			return nil, err
		}
		items = append(items, *ds)
	}

	if status.WriteUnified {
		s.mergeStoredMetaInto(ctx, items)
	}
	return s.page(items, options)
}

// listUnified filters by what the user can read, since the resource server only enforces access
// on groups it has been told about. A page may come back shorter than the limit.
func (s *datasourcesStore) listUnified(ctx context.Context, user identity.Requester, options *internalversion.ListOptions) (runtime.Object, error) {
	obj, err := s.unified.List(ctx, options)
	if err != nil {
		return nil, err
	}
	list, ok := obj.(*dataSourceMetadataList)
	if !ok {
		return obj, nil
	}
	readable := list.Items[:0]
	for _, ds := range list.Items {
		if s.canRead(ctx, user, ds.Name) {
			ds.pointAtServingGroup()
			readable = append(readable, ds)
		}
	}
	list.Items = readable
	return list, nil
}

// page applies the list options the table cannot: selectors and paging, in memory.
func (s *datasourcesStore) page(items []dataSourceMetadata, options *internalversion.ListOptions) (runtime.Object, error) {
	list := &dataSourceMetadataList{Items: []dataSourceMetadata{}}
	if options == nil {
		list.Items = items
		return list, nil
	}

	selected := items[:0:0]
	for _, ds := range items {
		if options.LabelSelector != nil && !options.LabelSelector.Matches(labels.Set(ds.Labels)) {
			continue
		}
		if options.FieldSelector != nil {
			if name, ok := options.FieldSelector.RequiresExactMatch("metadata.name"); ok && ds.Name != name {
				continue
			}
		}
		selected = append(selected, ds)
	}

	offset, err := parseConnectionsContinue(options.Continue)
	if err != nil {
		return nil, apierrors.NewBadRequest(err.Error())
	}
	limit := options.Limit
	if limit <= 0 {
		limit = int64(len(selected))
	}
	low, high, more := getSliceInfo(int64(len(selected)), offset, limit)
	list.Items = selected[low:high]
	if more {
		list.Continue = fmt.Sprintf("v1_%d", high)
	}
	return list, nil
}

// asDataSource converts a table row. The group label is written the way the collection stores it,
// so every storage mode answers with the same contract.
func (s *datasourcesStore) asDataSource(legacy *datasources.DataSource) (*dataSourceMetadata, error) {
	group := legacy.Type + "." + datasourceV0.GROUP
	full, err := converter.NewConverter(s.mapper, group, legacy.Type, nil).AsDataSource(legacy)
	if err != nil {
		return nil, err
	}
	ds := &dataSourceMetadata{ObjectMeta: full.ObjectMeta}
	if ds.Labels == nil {
		ds.Labels = map[string]string{}
	}
	ds.Labels[datasourceV0.LabelKeyGroup] = datasourceV0.GroupLabelValue(group)
	ds.pointAtServingGroup()
	return ds, nil
}

func (s *datasourcesStore) canRead(ctx context.Context, user identity.Requester, uid string) bool {
	evaluator := accesscontrol.EvalPermission(datasources.ActionRead,
		datasources.ScopeProvider.GetResourceScopeUID(uid))
	ok, _ := s.ac.Evaluate(ctx, user, evaluator)
	return ok
}

// mergeStoredMetaInto fills in the labels and annotations the table cannot hold. A failed read
// leaves the list as it is: losing the list costs more than losing the metadata.
func (s *datasourcesStore) mergeStoredMetaInto(ctx context.Context, items []dataSourceMetadata) {
	stored := map[string]runtime.Object{}
	options := &internalversion.ListOptions{Limit: annotationPageSize}
	for {
		rsp, err := s.unified.List(ctx, options)
		if err != nil {
			s.logger.Warn("could not read the stored data source metadata", "error", err)
			return
		}
		page, ok := rsp.(*dataSourceMetadataList)
		if !ok {
			return
		}
		for i := range page.Items {
			stored[page.Items[i].Name] = &page.Items[i]
		}
		if page.Continue == "" {
			break
		}
		options = &internalversion.ListOptions{Limit: annotationPageSize, Continue: page.Continue}
	}

	for i := range items {
		if found, ok := stored[items[i].Name]; ok {
			mergeStoredMeta(&items[i], found)
		}
	}
}

// mergeStoredMeta copies the stored labels and annotations onto a table row, which wins on
// everything else.
func mergeStoredMeta(ds *dataSourceMetadata, stored runtime.Object) {
	found, ok := stored.(*dataSourceMetadata)
	if !ok {
		return
	}
	for k, v := range found.Labels {
		if ds.Labels == nil {
			ds.Labels = map[string]string{}
		}
		ds.Labels[k] = v
	}
	for k, v := range found.Annotations {
		if ds.Annotations == nil {
			ds.Annotations = map[string]string{}
		}
		ds.Annotations[k] = v
	}
}

// newDataSourcesStore reads the collection unfiltered: every type is persisted under the datasource
// group, and the object keeps the label that names its type.
func (b *QueryAPIBuilder) newDataSourcesStore(opts builder.APIGroupOptions) (*datasourcesStore, error) {
	info := newDataSourcesResourceInfo(b.GetGroupVersion().Group)
	unified, err := grafanaregistry.NewRegistryStore(opts.Scheme, info, opts.StorageOptsGetterFor(info, apistore.StorageOptions{
		SharedStorage: &apistore.SharedStorage{Group: datasourceV0.GROUP, Unfiltered: true},
	}))
	if err != nil {
		return nil, err
	}
	return &datasourcesStore{
		resourceInfo:   info,
		tableConverter: info.TableConverter(),
		unified:        unified,
		legacy:         b.datasources.legacy,
		status:         b.datasources.storageStatus,
		ac:             b.datasources.accessControl,
		mapper:         b.datasources.mapper,
		logger:         log.New("query_apiserver.datasources"),
	}, nil
}
