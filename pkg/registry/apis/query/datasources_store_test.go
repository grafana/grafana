package query

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	k8srequest "k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/datasources"
	dsfakes "github.com/grafana/grafana/pkg/services/datasources/fakes"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
)

type fakeUnified struct {
	items []dataSourceMetadata
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
	return &dataSourceMetadataList{Items: f.items}, nil
}

func (f *fakeUnified) NewList() runtime.Object { return &dataSourceMetadataList{} }

func (f *fakeUnified) ConvertToTable(context.Context, runtime.Object, runtime.Object) (*metav1.Table, error) {
	return nil, errors.New("not used")
}

func storeContext() context.Context {
	ctx := k8srequest.WithNamespace(context.Background(), "default")
	return identity.WithRequester(ctx, &user.SignedInUser{OrgID: 1})
}

func newTestStore(status dualwrite.Service, unified *fakeUnified, canRead bool, rows ...*datasources.DataSource) *datasourcesStore {
	info := newDataSourcesResourceInfo("query.grafana.app")
	return &datasourcesStore{
		resourceInfo:   info,
		tableConverter: info.TableConverter(),
		unified:        unified,
		legacy:         &dsfakes.FakeDataSourceService{DataSources: rows},
		status:         status,
		ac:             actest.FakeAccessControl{ExpectedEvaluate: canRead},
		mapper:         func(int64) string { return "default" },
		logger:         log.NewNopLogger(),
	}
}

func rows() []*datasources.DataSource {
	return []*datasources.DataSource{
		{UID: "prom", Name: "Prometheus", Type: "prometheus", OrgID: 1, ID: 2},
		{UID: "loki", Name: "Loki", Type: "loki", OrgID: 1, ID: 1},
		{UID: "other-org", Name: "Elsewhere", Type: "loki", OrgID: 2, ID: 3},
	}
}

func managed(name, plugin string) dataSourceMetadata {
	return dataSourceMetadata{ObjectMeta: metav1.ObjectMeta{
		Name:        name,
		Labels:      map[string]string{datasourceV0.LabelKeyGroup: plugin},
		Annotations: map[string]string{utils.AnnoKeyManagerKind: "repo", utils.AnnoKeyManagerIdentity: "my-repo"},
	}}
}

func names(t *testing.T, obj runtime.Object) []string {
	t.Helper()
	list, ok := obj.(*dataSourceMetadataList)
	require.True(t, ok)
	out := make([]string, 0, len(list.Items))
	for _, item := range list.Items {
		out = append(out, item.Name)
	}
	return out
}

func TestDataSourcesStore_Legacy(t *testing.T) {
	status := dualwrite.ProvideTestService(dualwrite.StorageStatus{WriteLegacy: true})

	t.Run("lists every type of the org, sorted, with the group label", func(t *testing.T) {
		unified := &fakeUnified{}
		obj, err := newTestStore(status, unified, true, rows()...).List(storeContext(), &internalversion.ListOptions{})
		require.NoError(t, err)
		require.Equal(t, []string{"loki", "prom"}, names(t, obj))
		require.Zero(t, unified.calls, "the collection is not read below dual write")

		list := obj.(*dataSourceMetadataList)
		require.Equal(t, "loki", list.Items[0].Labels[datasourceV0.LabelKeyGroup])
		require.Equal(t, "prometheus", list.Items[1].Labels[datasourceV0.LabelKeyGroup])
		require.Equal(t, "loki.datasource.grafana.app/v0alpha1", list.Items[0].APIVersion)
		require.Equal(t, "DataSource", list.Items[0].Kind)
		require.Equal(t, "prometheus.datasource.grafana.app/v0alpha1", list.Items[1].APIVersion)
		require.NotContains(t, list.Items[0].Annotations, utils.AnnoKeyManagerKind)
	})

	t.Run("leaves out what the user cannot read", func(t *testing.T) {
		obj, err := newTestStore(status, &fakeUnified{}, false, rows()...).List(storeContext(), &internalversion.ListOptions{})
		require.NoError(t, err)
		require.Empty(t, names(t, obj))
	})

	t.Run("pages and keeps the order", func(t *testing.T) {
		store := newTestStore(status, &fakeUnified{}, true, rows()...)
		first, err := store.List(storeContext(), &internalversion.ListOptions{Limit: 1})
		require.NoError(t, err)
		require.Equal(t, []string{"loki"}, names(t, first))
		token := first.(*dataSourceMetadataList).Continue
		require.NotEmpty(t, token)

		second, err := store.List(storeContext(), &internalversion.ListOptions{Limit: 1, Continue: token})
		require.NoError(t, err)
		require.Equal(t, []string{"prom"}, names(t, second))
		require.Empty(t, second.(*dataSourceMetadataList).Continue)
	})

	t.Run("rejects a bad continue token", func(t *testing.T) {
		_, err := newTestStore(status, &fakeUnified{}, true, rows()...).List(storeContext(), &internalversion.ListOptions{Continue: "nope"})
		require.True(t, apierrors.IsBadRequest(err), "got %v", err)
	})

	t.Run("selects by group label and by name", func(t *testing.T) {
		store := newTestStore(status, &fakeUnified{}, true, rows()...)
		selector, err := labels.Parse(datasourceV0.LabelKeyGroup + "=prometheus")
		require.NoError(t, err)
		byLabel, err := store.List(storeContext(), &internalversion.ListOptions{LabelSelector: selector})
		require.NoError(t, err)
		require.Equal(t, []string{"prom"}, names(t, byLabel))

		byName, err := store.List(storeContext(), &internalversion.ListOptions{FieldSelector: fields.OneTermEqualSelector("metadata.name", "loki")})
		require.NoError(t, err)
		require.Equal(t, []string{"loki"}, names(t, byName))
	})

	t.Run("get returns the object across types", func(t *testing.T) {
		obj, err := newTestStore(status, &fakeUnified{}, true, rows()...).Get(storeContext(), "prom", &metav1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, "prometheus", obj.(*dataSourceMetadata).Labels[datasourceV0.LabelKeyGroup])
	})

	t.Run("get hides what is missing or unreadable", func(t *testing.T) {
		_, err := newTestStore(status, &fakeUnified{}, true, rows()...).Get(storeContext(), "missing", &metav1.GetOptions{})
		require.True(t, apierrors.IsNotFound(err), "got %v", err)

		_, err = newTestStore(status, &fakeUnified{}, false, rows()...).Get(storeContext(), "prom", &metav1.GetOptions{})
		require.True(t, apierrors.IsNotFound(err), "got %v", err)
	})
}

func TestDataSourcesStore_DualWrite(t *testing.T) {
	status := dualwrite.ProvideTestService(dualwrite.StorageStatus{WriteLegacy: true, WriteUnified: true})

	t.Run("takes the annotations from the collection", func(t *testing.T) {
		unified := &fakeUnified{items: []dataSourceMetadata{managed("loki", "loki")}}
		obj, err := newTestStore(status, unified, true, rows()...).List(storeContext(), &internalversion.ListOptions{})
		require.NoError(t, err)

		list := obj.(*dataSourceMetadataList)
		require.Equal(t, []string{"loki", "prom"}, names(t, obj))
		require.Equal(t, "repo", list.Items[0].Annotations[utils.AnnoKeyManagerKind])
		require.Equal(t, "my-repo", list.Items[0].Annotations[utils.AnnoKeyManagerIdentity])
		require.NotContains(t, list.Items[1].Annotations, utils.AnnoKeyManagerKind)
	})

	t.Run("a failed read of the collection still lists the table", func(t *testing.T) {
		unified := &fakeUnified{err: errors.New("boom")}
		obj, err := newTestStore(status, unified, true, rows()...).List(storeContext(), &internalversion.ListOptions{})
		require.NoError(t, err)
		require.Equal(t, []string{"loki", "prom"}, names(t, obj))
	})

	t.Run("get takes the annotations from the collection", func(t *testing.T) {
		unified := &fakeUnified{items: []dataSourceMetadata{managed("loki", "loki")}}
		obj, err := newTestStore(status, unified, true, rows()...).Get(storeContext(), "loki", &metav1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, "repo", obj.(*dataSourceMetadata).Annotations[utils.AnnoKeyManagerKind])
	})

	t.Run("get without a stored copy returns the row", func(t *testing.T) {
		obj, err := newTestStore(status, &fakeUnified{}, true, rows()...).Get(storeContext(), "prom", &metav1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, "prom", obj.(*dataSourceMetadata).Name)
	})
}

func TestDataSourcesStore_Unified(t *testing.T) {
	status := dualwrite.ProvideTestService(dualwrite.StorageStatus{WriteUnified: true, ReadUnified: true})
	unified := &fakeUnified{items: []dataSourceMetadata{managed("stored", "loki")}}
	store := newTestStore(status, unified, true, rows()...)

	t.Run("list reads the collection, not the table", func(t *testing.T) {
		obj, err := store.List(storeContext(), &internalversion.ListOptions{})
		require.NoError(t, err)
		require.Equal(t, []string{"stored"}, names(t, obj))
		require.Equal(t, "loki.datasource.grafana.app/v0alpha1", obj.(*dataSourceMetadataList).Items[0].APIVersion)
	})

	t.Run("get reads the collection, not the table", func(t *testing.T) {
		_, err := store.Get(storeContext(), "prom", &metav1.GetOptions{})
		require.True(t, apierrors.IsNotFound(err), "got %v", err)

		obj, err := store.Get(storeContext(), "stored", &metav1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, "repo", obj.(*dataSourceMetadata).Annotations[utils.AnnoKeyManagerKind])
	})
}

func TestDataSourcesStore_UnifiedAccess(t *testing.T) {
	status := dualwrite.ProvideTestService(dualwrite.StorageStatus{WriteUnified: true, ReadUnified: true})
	unified := &fakeUnified{items: []dataSourceMetadata{managed("stored", "loki")}}
	store := newTestStore(status, unified, false)

	obj, err := store.List(storeContext(), &internalversion.ListOptions{})
	require.NoError(t, err)
	require.Empty(t, names(t, obj), "the resource server does not enforce access on this group yet")

	_, err = store.Get(storeContext(), "stored", &metav1.GetOptions{})
	require.True(t, apierrors.IsNotFound(err), "got %v", err)
}

func TestDataSourcesStore_UnreadableMode(t *testing.T) {
	status := dualwrite.NewMockService(t)
	status.EXPECT().Status(mock.Anything, DataSourceCollectionResource).
		Return(dualwrite.StorageStatus{}, errors.New("no mode"))

	unified := &fakeUnified{}
	obj, err := newTestStore(status, unified, true, rows()...).List(storeContext(), &internalversion.ListOptions{})
	require.NoError(t, err)
	require.Equal(t, []string{"loki", "prom"}, names(t, obj), "the table is the complete store when the mode is unknown")
	require.Zero(t, unified.calls)
}
