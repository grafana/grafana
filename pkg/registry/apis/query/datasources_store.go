package query

import (
	"context"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
)

var (
	_ rest.Scoper               = (*datasourcesStore)(nil)
	_ rest.SingularNameProvider = (*datasourcesStore)(nil)
	_ rest.Lister               = (*datasourcesStore)(nil)
	_ rest.Storage              = (*datasourcesStore)(nil)
)

// datasourcesStore lists every datasource type through one read-only resource, as metadata only.
// A single datasource is read and written through the group that serves it.
type datasourcesStore struct {
	resourceInfo   utils.ResourceInfo
	tableConverter rest.TableConvertor
	lister         *dataSourceLister
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

func (s *datasourcesStore) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}
	q := listQuery{}
	if options != nil {
		q = listQuery{labels: options.LabelSelector, fields: options.FieldSelector, limit: options.Limit, cursor: options.Continue}
	}
	page, err := s.lister.list(ctx, user, info.OrgID, q)
	if err != nil {
		return nil, err
	}

	list := &dataSourceMetadataList{
		ListMeta: metav1.ListMeta{Continue: page.cursor},
		Items:    make([]dataSourceMetadata, 0, len(page.items)),
	}
	for _, item := range page.items {
		ds := dataSourceMetadata{ObjectMeta: item.meta}
		ds.pointAt(item.group())
		list.Items = append(list.Items, ds)
	}
	return list, nil
}

// newDataSourcesStore reads the collection unfiltered: every type is persisted under the datasource
// group, and each object keeps the label that names its type.
func (b *QueryAPIBuilder) newDataSourcesStore(opts builder.APIGroupOptions) (*datasourcesStore, error) {
	group := b.GetGroupVersion().Group
	stored := datasourceV0.DataSourceResourceInfo.WithGroupAndShortName(group, "")
	unified, err := grafanaregistry.NewRegistryStore(opts.Scheme, stored, opts.StorageOptsGetterFor(stored, apistore.StorageOptions{
		SharedStorage: &apistore.SharedStorage{Group: datasourceV0.GROUP, Unfiltered: true},
	}))
	if err != nil {
		return nil, err
	}
	info := newDataSourcesResourceInfo(group)
	b.lister = &dataSourceLister{
		resource: info.GroupResource(),
		unified:  unified,
		legacy:   b.datasources.legacy,
		status:   b.datasources.storageStatus,
		registry: b.registry,
		ac:       b.datasources.accessControl,
		mapper:   b.datasources.mapper,
	}
	return &datasourcesStore{
		resourceInfo:   info,
		tableConverter: info.TableConverter(),
		lister:         b.lister,
	}, nil
}
