package service

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
)

func TestDataSourceRetrieverImpl_CanonicalizesAliasType(t *testing.T) {
	pluginStore := pluginstore.NewFakePluginStore(pluginstore.Plugin{
		JSONData: plugins.JSONData{
			ID:       "grafana-pyroscope-datasource",
			AliasIDs: []string{"phlare"},
		},
	})
	store := NewMockStore(t)
	store.EXPECT().
		GetDataSource(mock.Anything, mock.Anything).
		Return(&datasources.DataSource{UID: "grafanacloud-profiles", Type: "phlare", OrgID: 1}, nil)

	retriever := &DataSourceRetrieverImpl{store: store}
	BindPluginStore(retriever, pluginStore)

	ds, err := retriever.GetDataSource(context.Background(), &datasources.GetDataSourceQuery{UID: "grafanacloud-profiles", OrgID: 1})
	require.NoError(t, err)
	require.NotNil(t, ds)
	assert.Equal(t, "grafana-pyroscope-datasource", ds.Type)
}

func TestDataSourceRetrieverImpl_UnsetPluginStoreLeavesAlias(t *testing.T) {
	store := NewMockStore(t)
	store.EXPECT().
		GetDataSource(mock.Anything, mock.Anything).
		Return(&datasources.DataSource{UID: "grafanacloud-profiles", Type: "phlare", OrgID: 1}, nil)

	retriever := &DataSourceRetrieverImpl{store: store}

	ds, err := retriever.GetDataSource(context.Background(), &datasources.GetDataSourceQuery{UID: "grafanacloud-profiles", OrgID: 1})
	require.NoError(t, err)
	require.NotNil(t, ds)
	assert.Equal(t, "phlare", ds.Type)
}
