package query

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
)

type fallbackConnections struct {
	list *datasourceV0.DataSourceConnectionList
	err  error
}

func (f *fallbackConnections) ListConnections(context.Context, datasourceV0.DataSourceConnectionQuery) (*datasourceV0.DataSourceConnectionList, error) {
	return f.list, f.err
}

func connectionsFor(lister *dataSourceLister) *listedConnections {
	c := &listedConnections{fallback: &fallbackConnections{list: &datasourceV0.DataSourceConnectionList{
		Items: []datasourceV0.DataSourceConnection{{Name: "from-fallback"}},
	}}}
	if lister != nil {
		c.useLister(lister)
	}
	return c
}

func TestListedConnections(t *testing.T) {
	query := datasourceV0.DataSourceConnectionQuery{Namespace: "default"}

	t.Run("answers from the fallback until the storage is built", func(t *testing.T) {
		list, err := connectionsFor(nil).ListConnections(storeContext(), query)
		require.NoError(t, err)
		require.Equal(t, "from-fallback", list.Items[0].Name)
	})

	t.Run("projects the listing", func(t *testing.T) {
		list, err := connectionsFor(newTestLister(listerOptions{canRead: true, rows: rows()})).ListConnections(storeContext(), query)
		require.NoError(t, err)
		require.Equal(t, "DataSourceConnectionList", list.Kind)
		require.Equal(t, []datasourceV0.DataSourceConnection{
			{Title: "Loki", Name: "loki", APIGroup: "loki.datasource.grafana.app", Plugin: "loki", Labels: map[string]string{"grafana.app/deprecatedInternalID": "1"}},
			{Title: "Prometheus", Name: "prom", APIGroup: "prometheus.datasource.grafana.app", Plugin: "prometheus", Labels: map[string]string{"grafana.app/deprecatedInternalID": "2"}},
		}, list.Items, "the alias resolves to the plugin and the group label is not repeated")
	})

	t.Run("by name", func(t *testing.T) {
		connections := connectionsFor(newTestLister(listerOptions{canRead: true, rows: rows()}))
		list, err := connections.ListConnections(storeContext(), datasourceV0.DataSourceConnectionQuery{Namespace: "default", Name: "prom"})
		require.NoError(t, err)
		require.Len(t, list.Items, 1)
		require.Equal(t, "prom", list.Items[0].Name)

		list, err = connections.ListConnections(storeContext(), datasourceV0.DataSourceConnectionQuery{Namespace: "default", Name: "nope"})
		require.NoError(t, err, "a name that is not there is an empty list")
		require.Empty(t, list.Items)
	})

	t.Run("follows the cursor until the collection is exhausted", func(t *testing.T) {
		const n = 1250
		items := make([]datasourceV0.DataSource, n)
		for i := range items {
			items[i] = stored(fmt.Sprintf("ds-%04d", i), "loki", false)
		}
		unified := &fakeUnified{items: items, pageSize: 500}
		status := &fakeStatus{shared: unifiedMode}
		list, err := connectionsFor(newTestLister(listerOptions{status: status, unified: unified, canRead: true})).ListConnections(storeContext(), query)
		require.NoError(t, err)
		require.Len(t, list.Items, n)
		require.Equal(t, "ds-1249", list.Items[n-1].Name)
	})

	t.Run("rejects another org and a bad namespace", func(t *testing.T) {
		connections := connectionsFor(newTestLister(listerOptions{canRead: true, rows: rows()}))
		_, err := connections.ListConnections(storeContext(), datasourceV0.DataSourceConnectionQuery{Namespace: "org-2"})
		require.True(t, apierrors.IsForbidden(err), "got %v", err)

		_, err = connections.ListConnections(storeContext(), datasourceV0.DataSourceConnectionQuery{Namespace: "default-ish!"})
		require.Error(t, err)
	})

	t.Run("a listing failure is reported", func(t *testing.T) {
		unified := &fakeUnified{err: errors.New("boom")}
		status := &fakeStatus{shared: unifiedMode}
		_, err := connectionsFor(newTestLister(listerOptions{status: status, unified: unified, canRead: true})).ListConnections(storeContext(), query)
		require.ErrorContains(t, err, "boom")
	})
}
