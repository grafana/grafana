package query

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	k8srequest "k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/datasources"
	dsfakes "github.com/grafana/grafana/pkg/services/datasources/fakes"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
)

var (
	legacyMode  = dualwrite.StorageStatus{WriteLegacy: true}
	dualMode    = dualwrite.StorageStatus{WriteLegacy: true, WriteUnified: true}
	unifiedMode = dualwrite.StorageStatus{WriteUnified: true, ReadUnified: true}
)

type fakeRegistry struct {
	servers []datasourceV0.DataSourceApiServer
	err     error
}

func (f *fakeRegistry) GetDatasourceGroupVersion(string) (schema.GroupVersion, error) {
	return schema.GroupVersion{}, errors.New("not used")
}

func (f *fakeRegistry) GetDatasourceApiServers(context.Context) (*datasourceV0.DataSourceApiServerList, error) {
	if f.err != nil {
		return nil, f.err
	}
	return &datasourceV0.DataSourceApiServerList{Items: f.servers}, nil
}

func plugin(id string, aliases ...string) datasourceV0.DataSourceApiServer {
	return datasourceV0.DataSourceApiServer{ObjectMeta: metav1.ObjectMeta{Name: id}, AliasIDs: aliases}
}

// fakeStatus answers the shared key and per-type groups separately. An installed type without a
// mode of its own inherits the shared one, as the datasource API builders configure it.
type fakeStatus struct {
	shared  dualwrite.StorageStatus
	byGroup map[string]dualwrite.StorageStatus
	err     error
}

func (f *fakeStatus) NewStorage(schema.GroupResource, grafanarest.Storage, grafanarest.Storage) (grafanarest.Storage, error) {
	return nil, errors.New("not used")
}

func (f *fakeStatus) ValidateServedVersions(context.Context, schema.GroupResource, []schema.GroupVersion) error {
	return nil
}

func (f *fakeStatus) ReadFromUnified(ctx context.Context, gr schema.GroupResource) (bool, error) {
	s, err := f.Status(ctx, gr)
	return s.ReadUnified, err
}

func (f *fakeStatus) Status(_ context.Context, gr schema.GroupResource) (dualwrite.StorageStatus, error) {
	if f.err != nil {
		return dualwrite.StorageStatus{}, f.err
	}
	if gr == DataSourceCollectionResource {
		return f.shared, nil
	}
	if s, ok := f.byGroup[gr.Group]; ok {
		return s, nil
	}
	return f.shared, nil
}

func (f *fakeStatus) Update(context.Context, dualwrite.StorageStatus) (dualwrite.StorageStatus, error) {
	return dualwrite.StorageStatus{}, errors.New("not used")
}

type fakeUnified struct {
	items []datasourceV0.DataSource
	err   error
	calls int
}

func (f *fakeUnified) Get(_ context.Context, name string, _ *metav1.GetOptions) (runtime.Object, error) {
	f.calls++
	if f.err != nil {
		return nil, f.err
	}
	for i := range f.items {
		if f.items[i].Name == name {
			return &f.items[i], nil
		}
	}
	return nil, apierrors.NewNotFound(DataSourceCollectionResource, name)
}

func (f *fakeUnified) List(context.Context, *internalversion.ListOptions) (runtime.Object, error) {
	f.calls++
	if f.err != nil {
		return nil, f.err
	}
	return &datasourceV0.DataSourceList{Items: f.items}, nil
}

func (f *fakeUnified) NewList() runtime.Object { return &datasourceV0.DataSourceList{} }

func (f *fakeUnified) ConvertToTable(context.Context, runtime.Object, runtime.Object) (*metav1.Table, error) {
	return nil, errors.New("not used")
}

func storeContext() context.Context {
	ctx := k8srequest.WithNamespace(context.Background(), "default")
	return identity.WithRequester(ctx, &user.SignedInUser{OrgID: 1})
}

func testUser() identity.Requester { return &user.SignedInUser{OrgID: 1} }

type listerOptions struct {
	status  *fakeStatus
	unified *fakeUnified
	plugins []datasourceV0.DataSourceApiServer
	canRead bool
	rows    []*datasources.DataSource
}

func newTestLister(o listerOptions) *dataSourceLister {
	if o.status == nil {
		o.status = &fakeStatus{shared: legacyMode}
	}
	if o.unified == nil {
		o.unified = &fakeUnified{}
	}
	if o.plugins == nil {
		o.plugins = []datasourceV0.DataSourceApiServer{plugin("prometheus"), plugin("loki", "old-loki")}
	}
	return &dataSourceLister{
		resource: schema.GroupResource{Group: "query.grafana.app", Resource: "datasources"},
		unified:  o.unified,
		legacy:   &dsfakes.FakeDataSourceService{DataSources: o.rows},
		status:   o.status,
		registry: &fakeRegistry{servers: o.plugins},
		ac:       actest.FakeAccessControl{ExpectedEvaluate: o.canRead},
		mapper:   func(int64) string { return "default" },
	}
}

func rows() []*datasources.DataSource {
	return []*datasources.DataSource{
		{UID: "loki", Name: "Loki", Type: "old-loki", OrgID: 1, ID: 1},
		{UID: "prom", Name: "Prometheus", Type: "prometheus", OrgID: 1, ID: 2},
		{UID: "other-org", Name: "Elsewhere", Type: "loki", OrgID: 2, ID: 3},
	}
}

func stored(name, plugin string, managed bool) datasourceV0.DataSource {
	ds := datasourceV0.DataSource{ObjectMeta: metav1.ObjectMeta{
		Name:   name,
		Labels: map[string]string{datasourceV0.LabelKeyGroup: plugin},
	}}
	ds.Spec.SetTitle("Stored " + name)
	if managed {
		ds.Annotations = map[string]string{utils.AnnoKeyManagerKind: "repo", utils.AnnoKeyManagerIdentity: "my-repo"}
	}
	return ds
}

func names(page *listPage) []string {
	out := make([]string, 0, len(page.items))
	for _, item := range page.items {
		out = append(out, item.meta.Name)
	}
	return out
}

func TestDataSourceLister_Table(t *testing.T) {
	t.Run("lists every type of the org with the canonical group label", func(t *testing.T) {
		unified := &fakeUnified{}
		page, err := newTestLister(listerOptions{unified: unified, canRead: true, rows: rows()}).list(storeContext(), testUser(), 1, listQuery{})
		require.NoError(t, err)
		require.Equal(t, []string{"loki", "prom"}, names(page))
		require.Zero(t, unified.calls, "the collection is not read below dual write")

		require.Equal(t, "loki", page.items[0].plugin, "the alias resolves to the plugin")
		require.Equal(t, "loki", page.items[0].meta.Labels[datasourceV0.LabelKeyGroup])
		require.Equal(t, "loki.datasource.grafana.app", page.items[0].group())
		require.Equal(t, "Loki", page.items[0].title)
		require.Equal(t, "prometheus", page.items[1].plugin)
		require.Empty(t, page.cursor)
	})

	t.Run("leaves out what the user cannot read", func(t *testing.T) {
		page, err := newTestLister(listerOptions{canRead: false, rows: rows()}).list(storeContext(), testUser(), 1, listQuery{})
		require.NoError(t, err)
		require.Empty(t, names(page))
	})

	t.Run("pages the table in SQL", func(t *testing.T) {
		lister := newTestLister(listerOptions{canRead: true, rows: rows()})
		first, err := lister.list(storeContext(), testUser(), 1, listQuery{limit: 1})
		require.NoError(t, err)
		require.Equal(t, []string{"loki"}, names(first))
		require.Equal(t, "v1_1", first.cursor)

		second, err := lister.list(storeContext(), testUser(), 1, listQuery{limit: 1, cursor: first.cursor})
		require.NoError(t, err)
		require.Equal(t, []string{"prom"}, names(second))
		require.Empty(t, second.cursor, "the last page knows it is the last")

		beyond, err := lister.list(storeContext(), testUser(), 1, listQuery{limit: 1, cursor: "v1_99"})
		require.NoError(t, err)
		require.Empty(t, names(beyond))
	})

	t.Run("rejects a bad continue token", func(t *testing.T) {
		_, err := newTestLister(listerOptions{canRead: true, rows: rows()}).list(storeContext(), testUser(), 1, listQuery{limit: 1, cursor: "nope"})
		require.True(t, apierrors.IsBadRequest(err), "got %v", err)
	})

	t.Run("selects by label and by any field operator", func(t *testing.T) {
		lister := newTestLister(listerOptions{canRead: true, rows: rows()})
		selector, err := labels.Parse(datasourceV0.LabelKeyGroup + "=prometheus")
		require.NoError(t, err)
		byLabel, err := lister.list(storeContext(), testUser(), 1, listQuery{labels: selector})
		require.NoError(t, err)
		require.Equal(t, []string{"prom"}, names(byLabel))

		byName, err := lister.list(storeContext(), testUser(), 1, listQuery{fields: fields.OneTermEqualSelector("metadata.name", "loki")})
		require.NoError(t, err)
		require.Equal(t, []string{"loki"}, names(byName))

		notName, err := lister.list(storeContext(), testUser(), 1, listQuery{fields: fields.OneTermNotEqualSelector("metadata.name", "prom")})
		require.NoError(t, err)
		require.Equal(t, []string{"loki"}, names(notName))
	})
}

func TestDataSourceLister_DualWrite(t *testing.T) {
	status := &fakeStatus{shared: dualMode}

	t.Run("takes the annotations from the collection", func(t *testing.T) {
		unified := &fakeUnified{items: []datasourceV0.DataSource{stored("loki", "loki", true)}}
		page, err := newTestLister(listerOptions{status: status, unified: unified, canRead: true, rows: rows()}).list(storeContext(), testUser(), 1, listQuery{})
		require.NoError(t, err)
		require.Equal(t, []string{"loki", "prom"}, names(page))
		require.Equal(t, "my-repo", page.items[0].meta.Annotations[utils.AnnoKeyManagerIdentity])
		require.Equal(t, "Loki", page.items[0].title, "the table row wins on everything but labels and annotations")
		require.NotContains(t, page.items[1].meta.Annotations, utils.AnnoKeyManagerKind)
	})

	t.Run("fails when the collection cannot be read", func(t *testing.T) {
		unified := &fakeUnified{err: errors.New("boom")}
		_, err := newTestLister(listerOptions{status: status, unified: unified, canRead: true, rows: rows()}).list(storeContext(), testUser(), 1, listQuery{})
		require.ErrorContains(t, err, "boom")
	})

	t.Run("only a type written to both stores is merged", func(t *testing.T) {
		perType := &fakeStatus{shared: legacyMode, byGroup: map[string]dualwrite.StorageStatus{"loki.datasource.grafana.app": dualMode}}
		unified := &fakeUnified{items: []datasourceV0.DataSource{stored("loki", "loki", true), stored("prom", "prometheus", true)}}
		page, err := newTestLister(listerOptions{status: perType, unified: unified, canRead: true, rows: rows()}).list(storeContext(), testUser(), 1, listQuery{})
		require.NoError(t, err)
		require.Equal(t, "my-repo", page.items[0].meta.Annotations[utils.AnnoKeyManagerIdentity])
		require.Empty(t, page.items[1].meta.Annotations, "prometheus still reads and writes the table only")
	})
}

func TestDataSourceLister_Unified(t *testing.T) {
	status := &fakeStatus{shared: unifiedMode, byGroup: map[string]dualwrite.StorageStatus{
		"prometheus.datasource.grafana.app": unifiedMode,
		"loki.datasource.grafana.app":       unifiedMode,
	}}
	unified := &fakeUnified{items: []datasourceV0.DataSource{stored("stored", "loki", true)}}

	t.Run("reads the collection, not the table", func(t *testing.T) {
		page, err := newTestLister(listerOptions{status: status, unified: unified, canRead: true, rows: rows()}).list(storeContext(), testUser(), 1, listQuery{})
		require.NoError(t, err)
		require.Equal(t, []string{"stored"}, names(page))
		require.Equal(t, "loki.datasource.grafana.app", page.items[0].group())
		require.Equal(t, "Stored stored", page.items[0].title)
	})

	t.Run("still checks access per item", func(t *testing.T) {
		page, err := newTestLister(listerOptions{status: status, unified: unified, canRead: false, rows: rows()}).list(storeContext(), testUser(), 1, listQuery{})
		require.NoError(t, err)
		require.Empty(t, names(page))
	})
}

// One type already reads from the collection while another still reads from the table
func TestDataSourceLister_Mixed(t *testing.T) {
	status := &fakeStatus{shared: legacyMode, byGroup: map[string]dualwrite.StorageStatus{
		"prometheus.datasource.grafana.app": unifiedMode,
	}}
	unified := &fakeUnified{items: []datasourceV0.DataSource{
		stored("prom-new", "prometheus", true), // exists only in the collection
		stored("prom", "prometheus", false),
		stored("loki", "loki", true), // a copy of a table row; the table decides it exists
		stored("loki-gone", "loki", false),
	}}
	lister := newTestLister(listerOptions{status: status, unified: unified, canRead: true, rows: rows()})

	page, err := lister.list(storeContext(), testUser(), 1, listQuery{})
	require.NoError(t, err)
	require.Equal(t, []string{"loki", "prom", "prom-new"}, names(page), "each type comes from the store its API reads")
	require.Equal(t, "Loki", page.items[0].title, "loki is the table row")
	require.Empty(t, page.items[0].meta.Annotations, "loki only writes the table, so nothing is merged")
	require.Equal(t, "Stored prom", page.items[1].title, "prometheus is the stored object")

	first, err := lister.list(storeContext(), testUser(), 1, listQuery{limit: 2})
	require.NoError(t, err)
	require.Equal(t, []string{"loki", "prom"}, names(first))
	require.Equal(t, "v1_2", first.cursor)
	second, err := lister.list(storeContext(), testUser(), 1, listQuery{limit: 2, cursor: first.cursor})
	require.NoError(t, err)
	require.Equal(t, []string{"prom-new"}, names(second))
	require.Empty(t, second.cursor)
}

func TestDataSourceLister_Lookup(t *testing.T) {
	t.Run("table row, resolving the alias", func(t *testing.T) {
		item, err := newTestLister(listerOptions{canRead: true, rows: rows()}).lookup(storeContext(), testUser(), 1, "loki")
		require.NoError(t, err)
		require.Equal(t, "loki.datasource.grafana.app", item.group())
	})

	t.Run("missing or unreadable is not found", func(t *testing.T) {
		_, err := newTestLister(listerOptions{canRead: true, rows: rows()}).lookup(storeContext(), testUser(), 1, "missing")
		require.True(t, apierrors.IsNotFound(err), "got %v", err)
		_, err = newTestLister(listerOptions{canRead: false, rows: rows()}).lookup(storeContext(), testUser(), 1, "prom")
		require.True(t, apierrors.IsNotFound(err), "got %v", err)
	})

	t.Run("dual write merges the stored metadata and reports a failed read", func(t *testing.T) {
		status := &fakeStatus{shared: dualMode}
		item, err := newTestLister(listerOptions{status: status, unified: &fakeUnified{items: []datasourceV0.DataSource{stored("loki", "loki", true)}}, canRead: true, rows: rows()}).lookup(storeContext(), testUser(), 1, "loki")
		require.NoError(t, err)
		require.Equal(t, "my-repo", item.meta.Annotations[utils.AnnoKeyManagerIdentity])

		item, err = newTestLister(listerOptions{status: status, unified: &fakeUnified{}, canRead: true, rows: rows()}).lookup(storeContext(), testUser(), 1, "prom")
		require.NoError(t, err, "no stored copy yet is fine")
		require.Equal(t, "prom", item.meta.Name)

		_, err = newTestLister(listerOptions{status: status, unified: &fakeUnified{err: errors.New("boom")}, canRead: true, rows: rows()}).lookup(storeContext(), testUser(), 1, "prom")
		require.ErrorContains(t, err, "boom")
	})

	t.Run("a type reading the collection is answered by the collection", func(t *testing.T) {
		status := &fakeStatus{shared: legacyMode, byGroup: map[string]dualwrite.StorageStatus{"prometheus.datasource.grafana.app": unifiedMode}}
		unified := &fakeUnified{items: []datasourceV0.DataSource{stored("prom-new", "prometheus", true), stored("loki-gone", "loki", false)}}
		lister := newTestLister(listerOptions{status: status, unified: unified, canRead: true, rows: rows()})

		item, err := lister.lookup(storeContext(), testUser(), 1, "prom-new")
		require.NoError(t, err, "exists only in the collection")
		require.Equal(t, "Stored prom-new", item.title)

		_, err = lister.lookup(storeContext(), testUser(), 1, "prom")
		require.True(t, apierrors.IsNotFound(err), "the table row is stale once prometheus reads the collection: %v", err)

		_, err = lister.lookup(storeContext(), testUser(), 1, "loki-gone")
		require.True(t, apierrors.IsNotFound(err), "a stored copy of a table-only type is not a datasource: %v", err)
	})
}

func TestDataSourceLister_ModeErrors(t *testing.T) {
	_, err := newTestLister(listerOptions{status: &fakeStatus{err: errors.New("no mode")}, canRead: true, rows: rows()}).list(storeContext(), testUser(), 1, listQuery{})
	require.ErrorContains(t, err, "no mode")

	lister := newTestLister(listerOptions{canRead: true, rows: rows()})
	lister.registry = &fakeRegistry{err: errors.New("no plugins")}
	_, err = lister.list(storeContext(), testUser(), 1, listQuery{})
	require.ErrorContains(t, err, "no plugins")
}

func TestDataSourcesStore_List(t *testing.T) {
	info := newDataSourcesResourceInfo("query.grafana.app")
	store := &datasourcesStore{
		resourceInfo:   info,
		tableConverter: info.TableConverter(),
		lister:         newTestLister(listerOptions{canRead: true, rows: rows()}),
	}

	obj, err := store.List(storeContext(), &internalversion.ListOptions{Limit: 1})
	require.NoError(t, err)
	list, ok := obj.(*dataSourceMetadataList)
	require.True(t, ok)
	require.Len(t, list.Items, 1)
	require.Equal(t, "v1_1", list.Continue)
	require.Equal(t, "loki.datasource.grafana.app/v0alpha1", list.Items[0].APIVersion, "the item names the group that serves it")
	require.Equal(t, "DataSource", list.Items[0].Kind)
	require.Equal(t, "loki", list.Items[0].Labels[datasourceV0.LabelKeyGroup])

	for _, item := range list.Items {
		require.NotEmpty(t, item.Name, fmt.Sprintf("%+v", item))
	}
}
