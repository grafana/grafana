package service

import (
	"context"
	"testing"

	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/services/datasources"
)

type fakeDataSourceRetrieverStore struct {
	Store
	res []*datasources.DataSource
}

func (f *fakeDataSourceRetrieverStore) GetDataSourceInNamespace(ctx context.Context, query *datasources.GetDataSourceInNamespaceQuery) (*datasources.DataSource, error) {
	ns, err := types.ParseNamespace(query.Namespace)
	if err != nil {
		return nil, err
	}
	for _, dataSource := range f.res {
		if query.Name != dataSource.UID || ns.OrgID != dataSource.OrgID {
			continue
		}
		if dataSource.Type == query.Type {
			return dataSource, nil
		}
		for _, alias := range query.AliasIDs {
			if dataSource.Type == alias {
				return dataSource, nil
			}
		}
	}
	return nil, datasources.ErrDataSourceNotFound
}

func TestUnitDataSourceRetrieverImpl_GetDataSourceInNamespace(t *testing.T) {
	store := &fakeDataSourceRetrieverStore{res: []*datasources.DataSource{
		{OrgID: 10, UID: "ds1", Type: "postgres"},
	}}
	pluginRegistry := registry.NewInMemory()
	require.NoError(t, pluginRegistry.Add(context.Background(), &plugins.Plugin{
		JSONData: plugins.JSONData{
			ID:       "grafana-postgresql-datasource",
			AliasIDs: []string{"postgres"},
		},
	}))
	r := &DataSourceRetrieverImpl{store: store, pluginRegistry: pluginRegistry}

	t.Run("resolves the canonical plugin ID to a datasource stored under its legacy alias", func(t *testing.T) {
		ds, err := r.GetDataSourceInNamespace(context.Background(), &datasources.GetDataSourceInNamespaceQuery{
			Namespace: "org-10", Name: "ds1", Type: "grafana-postgresql-datasource",
		})
		require.NoError(t, err)
		require.Equal(t, "ds1", ds.UID)
	})

	t.Run("resolves the legacy alias directly", func(t *testing.T) {
		ds, err := r.GetDataSourceInNamespace(context.Background(), &datasources.GetDataSourceInNamespaceQuery{
			Namespace: "org-10", Name: "ds1", Type: "postgres",
		})
		require.NoError(t, err)
		require.Equal(t, "ds1", ds.UID)
	})

	t.Run("returns not found for an unrelated type", func(t *testing.T) {
		_, err := r.GetDataSourceInNamespace(context.Background(), &datasources.GetDataSourceInNamespaceQuery{
			Namespace: "org-10", Name: "ds1", Type: "influxdb",
		})
		require.ErrorIs(t, err, datasources.ErrDataSourceNotFound)
	})

	t.Run("falls back to the literal type when the plugin isn't registered", func(t *testing.T) {
		unregisteredStore := &fakeDataSourceRetrieverStore{res: []*datasources.DataSource{
			{OrgID: 10, UID: "ds2", Type: "some-unregistered-type"},
		}}
		unregistered := &DataSourceRetrieverImpl{store: unregisteredStore, pluginRegistry: registry.NewInMemory()}

		ds, err := unregistered.GetDataSourceInNamespace(context.Background(), &datasources.GetDataSourceInNamespaceQuery{
			Namespace: "org-10", Name: "ds2", Type: "some-unregistered-type",
		})
		require.NoError(t, err)
		require.Equal(t, "ds2", ds.UID)
	})

	t.Run("falls back to the literal type when pluginRegistry is nil", func(t *testing.T) {
		unregistered := &DataSourceRetrieverImpl{store: store, pluginRegistry: nil}

		ds, err := unregistered.GetDataSourceInNamespace(context.Background(), &datasources.GetDataSourceInNamespaceQuery{
			Namespace: "org-10", Name: "ds1", Type: "postgres",
		})
		require.NoError(t, err)
		require.Equal(t, "ds1", ds.UID)
	})

	t.Run("respects a caller-provided AliasIDs without resolving via the registry", func(t *testing.T) {
		ds, err := r.GetDataSourceInNamespace(context.Background(), &datasources.GetDataSourceInNamespaceQuery{
			Namespace: "org-10", Name: "ds1", Type: "influxdb", AliasIDs: []string{"postgres"},
		})
		require.NoError(t, err)
		require.Equal(t, "ds1", ds.UID)
	})
}
