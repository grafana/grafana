package query

import (
	"context"
	"errors"
	"fmt"
	"sort"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/datasource/converter"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
)

// DataSourceCollectionResource is the unified storage collection that holds every datasource type.
// Its storage mode is the default for every type without a mode of its own.
var DataSourceCollectionResource = schema.GroupResource{
	Group:    datasourceV0.GROUP,
	Resource: datasourceV0.DataSourceResourceInfo.GetName(),
}

var errExpectedDataSource = errors.New("expected a datasource")

// collectionPageSize bounds each read when the whole collection is walked.
const collectionPageSize = 500

type unifiedDataSources interface {
	rest.Getter
	rest.Lister
}

type legacyDataSources interface {
	GetDataSources(ctx context.Context, query *datasources.GetDataSourcesQuery) ([]*datasources.DataSource, error)
	GetDataSource(ctx context.Context, query *datasources.GetDataSourceQuery) (*datasources.DataSource, error)
}

// listedDataSource is a datasource as the cross-type listings see it: its metadata, the plugin
// that serves it, and the title the connections listing shows.
type listedDataSource struct {
	meta   metav1.ObjectMeta
	title  string
	plugin string
}

// group is the API group that serves and writes the datasource, empty when unknown.
func (d listedDataSource) group() string {
	if d.plugin == "" {
		return ""
	}
	return d.plugin + "." + datasourceV0.GROUP
}

type listQuery struct {
	labels labels.Selector
	fields fields.Selector
	limit  int64
	cursor string
}

func (q listQuery) matches(d listedDataSource) bool {
	if q.labels != nil && !q.labels.Matches(labels.Set(d.meta.Labels)) {
		return false
	}
	if q.fields != nil && !q.fields.Matches(fields.Set{"metadata.name": d.meta.Name, "metadata.namespace": d.meta.Namespace}) {
		return false
	}
	return true
}

type listPage struct {
	items  []listedDataSource
	cursor string
}

// dataSourceLister lists every datasource type at once, from the collection or the table.
//
// Each type's API picks its own storage mode, with the shared datasource key as the default, so
// the lister resolves the mode per type and reads each one where its API would. The table has no
// labels or annotations, so a type that is written to both stores takes them from the collection.
type dataSourceLister struct {
	resource schema.GroupResource
	unified  unifiedDataSources
	legacy   legacyDataSources
	status   dualwrite.Service
	registry datasourceV0.DataSourceApiServerRegistry
	ac       accesscontrol.AccessControl
	mapper   request.NamespaceMapper
}

// storageModes is the effective storage mode of every served datasource type.
type storageModes struct {
	shared  dualwrite.StorageStatus
	plugins map[string]dualwrite.StorageStatus
	aliases map[string]string
}

func (m storageModes) canonical(plugin string) string {
	if c, ok := m.aliases[plugin]; ok {
		return c
	}
	return plugin
}

func (m storageModes) of(plugin string) dualwrite.StorageStatus {
	if s, ok := m.plugins[m.canonical(plugin)]; ok {
		return s
	}
	return m.shared
}

func (m storageModes) allUnified() bool {
	if !m.shared.ReadUnified {
		return false
	}
	for _, s := range m.plugins {
		if !s.ReadUnified {
			return false
		}
	}
	return true
}

func (m storageModes) anyUnified() bool {
	if m.shared.ReadUnified {
		return true
	}
	for _, s := range m.plugins {
		if s.ReadUnified {
			return true
		}
	}
	return false
}

func (m storageModes) anyWriteUnified() bool {
	if m.shared.WriteUnified {
		return true
	}
	for _, s := range m.plugins {
		if s.WriteUnified {
			return true
		}
	}
	return false
}

// modes resolves the storage mode of every installed datasource plugin the way its own API does,
// and records the alias IDs so table rows written under an alias resolve to the canonical plugin.
func (l *dataSourceLister) modes(ctx context.Context) (storageModes, error) {
	shared, err := l.status.Status(ctx, DataSourceCollectionResource)
	if err != nil {
		return storageModes{}, fmt.Errorf("reading the datasource storage mode: %w", err)
	}
	m := storageModes{
		shared:  shared,
		plugins: map[string]dualwrite.StorageStatus{},
		aliases: map[string]string{},
	}
	servers, err := l.registry.GetDatasourceApiServers(ctx)
	if err != nil {
		return storageModes{}, fmt.Errorf("listing datasource plugins: %w", err)
	}
	for _, srv := range servers.Items {
		gr := schema.GroupResource{Group: srv.Name + "." + datasourceV0.GROUP, Resource: l.resource.Resource}
		status, err := l.status.Status(ctx, gr)
		if err != nil {
			return storageModes{}, fmt.Errorf("reading the storage mode of %s: %w", gr.Group, err)
		}
		m.plugins[srv.Name] = status
		for _, alias := range srv.AliasIDs {
			m.aliases[alias] = srv.Name
		}
	}
	return m, nil
}

func (l *dataSourceLister) list(ctx context.Context, user identity.Requester, orgID int64, q listQuery) (*listPage, error) {
	modes, err := l.modes(ctx)
	if err != nil {
		return nil, err
	}
	switch {
	case modes.allUnified():
		return l.listUnified(ctx, user, q)
	case !modes.anyUnified():
		return l.listTable(ctx, user, orgID, modes, q)
	default:
		return l.listMixed(ctx, user, orgID, modes, q)
	}
}

// listUnified reads the collection, which pages and selects natively. Access is checked per item
// because the resource server does not enforce it for this collection, so a page may come back
// shorter than the limit.
func (l *dataSourceLister) listUnified(ctx context.Context, user identity.Requester, q listQuery) (*listPage, error) {
	obj, err := l.unified.List(ctx, &internalversion.ListOptions{
		LabelSelector: q.labels,
		FieldSelector: q.fields,
		Limit:         q.limit,
		Continue:      q.cursor,
	})
	if err != nil {
		return nil, err
	}
	stored, ok := obj.(*datasourceV0.DataSourceList)
	if !ok {
		return nil, errExpectedDataSource
	}
	page := &listPage{items: []listedDataSource{}, cursor: stored.Continue}
	for i := range stored.Items {
		if l.canRead(ctx, user, stored.Items[i].Name) {
			page.items = append(page.items, fromStored(&stored.Items[i]))
		}
	}
	return page, nil
}

// listTable pages the table in SQL and answers in its order. Types written to both stores take
// their labels and annotations from the collection; that read failing fails the list, since
// callers decide what a datasource is and who manages it from them.
func (l *dataSourceLister) listTable(ctx context.Context, user identity.Requester, orgID int64, modes storageModes, q listQuery) (*listPage, error) {
	offset, err := parseConnectionsContinue(q.cursor)
	if err != nil {
		return nil, apierrors.NewBadRequest(err.Error())
	}

	query := &datasources.GetDataSourcesQuery{OrgID: orgID}
	if q.limit > 0 {
		query.DataSourceLimit = int(q.limit) + 1 // one more tells whether a next page exists
		query.Offset = int(offset)
	} else if offset > 0 {
		return nil, apierrors.NewBadRequest("continue requires a limit")
	}
	rows, err := l.legacy.GetDataSources(ctx, query)
	if err != nil {
		return nil, err
	}
	page := &listPage{items: []listedDataSource{}}
	if q.limit > 0 && int64(len(rows)) > q.limit {
		rows = rows[:q.limit]
		page.cursor = fmt.Sprintf("v1_%d", offset+q.limit)
	}

	var stored map[string]*datasourceV0.DataSource
	if modes.anyWriteUnified() {
		if stored, err = l.storedByName(ctx); err != nil {
			return nil, err
		}
	}

	for _, row := range rows {
		if !l.canRead(ctx, user, row.UID) {
			continue
		}
		item, err := l.fromRow(row, modes)
		if err != nil {
			return nil, err
		}
		if modes.of(item.plugin).WriteUnified {
			if s, ok := stored[row.UID]; ok {
				mergeStoredMeta(&item.meta, s.ObjectMeta)
			}
		}
		if q.matches(item) {
			page.items = append(page.items, item)
		}
	}
	return page, nil
}

// listMixed serves a transition: some types already read from the collection while others still
// read from the table. Both stores are read whole and paged in memory, since neither one alone
// can answer.
func (l *dataSourceLister) listMixed(ctx context.Context, user identity.Requester, orgID int64, modes storageModes, q listQuery) (*listPage, error) {
	offset, err := parseConnectionsContinue(q.cursor)
	if err != nil {
		return nil, apierrors.NewBadRequest(err.Error())
	}
	rows, err := l.legacy.GetDataSources(ctx, &datasources.GetDataSourcesQuery{OrgID: orgID})
	if err != nil {
		return nil, err
	}
	stored, err := l.storedByName(ctx)
	if err != nil {
		return nil, err
	}

	items := []listedDataSource{}
	for _, s := range stored {
		item := fromStored(s)
		if modes.of(item.plugin).ReadUnified {
			items = append(items, item)
		}
	}
	for _, row := range rows {
		item, err := l.fromRow(row, modes)
		if err != nil {
			return nil, err
		}
		mode := modes.of(item.plugin)
		if mode.ReadUnified {
			continue // the collection answered for this type
		}
		if mode.WriteUnified {
			if s, ok := stored[row.UID]; ok {
				mergeStoredMeta(&item.meta, s.ObjectMeta)
			}
		}
		items = append(items, item)
	}

	selected := items[:0]
	for _, item := range items {
		if q.matches(item) && l.canRead(ctx, user, item.meta.Name) {
			selected = append(selected, item)
		}
	}
	sort.Slice(selected, func(i, j int) bool { return selected[i].meta.Name < selected[j].meta.Name })

	limit := q.limit
	if limit <= 0 {
		limit = int64(len(selected))
	}
	low, high, more := getSliceInfo(int64(len(selected)), offset, limit)
	page := &listPage{items: selected[low:high]}
	if more {
		page.cursor = fmt.Sprintf("v1_%d", high)
	}
	return page, nil
}

// lookup finds one datasource by UID, whichever type it is. It backs the connections name filter.
func (l *dataSourceLister) lookup(ctx context.Context, user identity.Requester, orgID int64, name string) (*listedDataSource, error) {
	modes, err := l.modes(ctx)
	if err != nil {
		return nil, err
	}
	notFound := apierrors.NewNotFound(l.resource, name)

	var item listedDataSource
	switch {
	case modes.allUnified():
		stored, err := l.storedGet(ctx, name)
		if err != nil {
			return nil, err
		}
		item = fromStored(stored)
	default:
		row, err := l.legacy.GetDataSource(ctx, &datasources.GetDataSourceQuery{OrgID: orgID, UID: name})
		if err != nil && !errors.Is(err, datasources.ErrDataSourceNotFound) {
			return nil, err
		}
		if row == nil {
			// Only a type that reads from the collection can exist there alone
			stored, err := l.storedGet(ctx, name)
			if err != nil {
				return nil, err
			}
			item = fromStored(stored)
			if !modes.of(item.plugin).ReadUnified {
				return nil, notFound
			}
			break
		}
		if item, err = l.fromRow(row, modes); err != nil {
			return nil, err
		}
		mode := modes.of(item.plugin)
		if mode.ReadUnified {
			stored, err := l.storedGet(ctx, name)
			if err != nil {
				return nil, err
			}
			item = fromStored(stored)
		} else if mode.WriteUnified {
			stored, err := l.storedGet(ctx, name)
			if err != nil && !apierrors.IsNotFound(err) {
				return nil, err
			}
			if err == nil {
				mergeStoredMeta(&item.meta, stored.ObjectMeta)
			}
		}
	}

	if !l.canRead(ctx, user, item.meta.Name) {
		return nil, notFound
	}
	return &item, nil
}

func (l *dataSourceLister) storedGet(ctx context.Context, name string) (*datasourceV0.DataSource, error) {
	obj, err := l.unified.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		if apierrors.IsNotFound(err) {
			return nil, apierrors.NewNotFound(l.resource, name)
		}
		return nil, err
	}
	stored, ok := obj.(*datasourceV0.DataSource)
	if !ok {
		return nil, errExpectedDataSource
	}
	return stored, nil
}

// storedByName reads the whole collection, a page at a time.
func (l *dataSourceLister) storedByName(ctx context.Context) (map[string]*datasourceV0.DataSource, error) {
	stored := map[string]*datasourceV0.DataSource{}
	options := &internalversion.ListOptions{Limit: collectionPageSize}
	for {
		obj, err := l.unified.List(ctx, options)
		if err != nil {
			return nil, fmt.Errorf("reading the stored datasources: %w", err)
		}
		page, ok := obj.(*datasourceV0.DataSourceList)
		if !ok {
			return nil, errExpectedDataSource
		}
		for i := range page.Items {
			stored[page.Items[i].Name] = &page.Items[i]
		}
		if page.Continue == "" {
			return stored, nil
		}
		options = &internalversion.ListOptions{Limit: collectionPageSize, Continue: page.Continue}
	}
}

// fromStored reads the serving plugin from the label the collection keeps on every object.
func fromStored(ds *datasourceV0.DataSource) listedDataSource {
	return listedDataSource{
		meta:   ds.ObjectMeta,
		title:  ds.Spec.Title(),
		plugin: ds.Labels[datasourceV0.LabelKeyGroup],
	}
}

// fromRow converts a table row. The group label is written the way the collection stores it, so
// every storage mode answers with the same labels.
func (l *dataSourceLister) fromRow(row *datasources.DataSource, modes storageModes) (listedDataSource, error) {
	plugin := modes.canonical(row.Type)
	full, err := converter.NewConverter(l.mapper, plugin+"."+datasourceV0.GROUP, row.Type, nil).AsDataSource(row)
	if err != nil {
		return listedDataSource{}, err
	}
	meta := full.ObjectMeta
	if meta.Labels == nil {
		meta.Labels = map[string]string{}
	}
	meta.Labels[datasourceV0.LabelKeyGroup] = plugin
	return listedDataSource{meta: meta, title: row.Name, plugin: plugin}, nil
}

func (l *dataSourceLister) canRead(ctx context.Context, user identity.Requester, uid string) bool {
	evaluator := accesscontrol.EvalPermission(datasources.ActionRead,
		datasources.ScopeProvider.GetResourceScopeUID(uid))
	ok, _ := l.ac.Evaluate(ctx, user, evaluator)
	return ok
}

// mergeStoredMeta copies the stored labels and annotations onto a table row, which wins on
// everything else.
func mergeStoredMeta(meta *metav1.ObjectMeta, stored metav1.ObjectMeta) {
	for k, v := range stored.Labels {
		if meta.Labels == nil {
			meta.Labels = map[string]string{}
		}
		meta.Labels[k] = v
	}
	for k, v := range stored.Annotations {
		if meta.Annotations == nil {
			meta.Annotations = map[string]string{}
		}
		meta.Annotations[k] = v
	}
}
