package query

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"slices"
	"testing"

	"github.com/gorilla/mux"
	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	queryV1 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

type testConnectionsProvider struct {
	list  *queryV1.DataSourceConnectionList
	calls int
}

func (p *testConnectionsProvider) ListConnections(_ context.Context, _ queryV1.DataSourceConnectionQuery) (*queryV1.DataSourceConnectionList, error) {
	p.calls++
	return p.list, nil
}

func TestGetConnectionsPagination(t *testing.T) {
	require.NoError(t, openfeature.SetProviderAndWait(memprovider.NewInMemoryProvider(map[string]memprovider.InMemoryFlag{
		featuremgmt.FlagQueryServiceWithConnections: {
			Key:            featuremgmt.FlagQueryServiceWithConnections,
			DefaultVariant: "enabled",
			Variants:       map[string]any{"enabled": true},
		},
	})))
	t.Cleanup(func() { require.NoError(t, openfeature.SetProviderAndWait(openfeature.NoopProvider{})) })

	request := func(items []queryV1.DataSourceConnection, url string) queryV1.DataSourceConnectionList {
		t.Helper()
		r := mux.SetURLVars(httptest.NewRequest(http.MethodGet, url, nil), map[string]string{"namespace": "default"})
		w := httptest.NewRecorder()

		provider := &testConnectionsProvider{list: &queryV1.DataSourceConnectionList{
			TypeMeta: metav1.TypeMeta{Kind: "DataSourceConnectionList", APIVersion: "v0alpha1"},
			ListMeta: metav1.ListMeta{ResourceVersion: "42"},
			Items:    items,
		}}
		builder := &QueryAPIBuilder{instanceProvider: mockInstanceProvider{}, connections: provider}

		builder.GetConnections(w, r)
		require.Equal(t, http.StatusOK, w.Code, w.Body.String())
		var result queryV1.DataSourceConnectionList
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &result))
		require.Equal(t, "DataSourceConnectionList", result.Kind)
		require.Equal(t, "v0alpha1", result.APIVersion)
		return result
	}

	// the max-limit is a high number (1000), so we need an array that is longer than that
	items2500 := make([]queryV1.DataSourceConnection, 3000)
	for i := 0; i < len(items2500); i++ {
		items2500[i].Name = fmt.Sprintf("n_%d", i)
	}

	items3 := []queryV1.DataSourceConnection{{Name: "a"}, {Name: "b"}, {Name: "c"}}
	items0 := []queryV1.DataSourceConnection{}

	first := request(items3, "/connections?limit=2")
	require.Equal(t, items3[:2], first.Items)
	require.Equal(t, "v1_2", first.Continue)

	second := request(items3, "/connections?limit=2&continue="+first.Continue)
	require.Equal(t, items3[2:], second.Items)
	require.Equal(t, "", second.Continue)

	unlimited := request(items3, "/connections")
	require.Equal(t, items3, unlimited.Items)
	require.Equal(t, "", unlimited.Continue)

	unlimited2 := request(items3, "/connections?limit=0")
	require.Equal(t, items3, unlimited2.Items)
	require.Equal(t, "", unlimited2.Continue)

	exact := request(items3, "/connections?limit=3")
	require.Equal(t, items3, exact.Items)
	require.Equal(t, "", exact.Continue)

	last := request(items3, "/connections?continue=v1_2")
	require.Equal(t, items3[2:], last.Items)
	require.Equal(t, "", last.Continue)

	empty := request(items3, "/connections?limit=2&continue=v1_3")
	require.Len(t, empty.Items, 0)
	require.Equal(t, "", empty.Continue)

	beyond := request(items3, "/connections?limit=2&continue=v1_99")
	require.Len(t, beyond.Items, 0)
	require.Equal(t, "", beyond.Continue)

	emptyList := request(items0, "/connections?limit=2")
	require.Len(t, emptyList.Items, 0)
	require.Equal(t, "", emptyList.Continue)

	// now for the long array
	long1 := request(items2500, "/connections")
	require.Len(t, long1.Items, int(maxConnectionsLimit))
	require.Equal(t, "v1_1000", long1.Continue)

	long2 := request(items2500, "/connections?continue="+long1.Continue)
	require.Len(t, long2.Items, int(maxConnectionsLimit))
	require.Equal(t, "v1_2000", long2.Continue)

	long3 := request(items2500, "/connections?continue="+long2.Continue)
	require.Len(t, long3.Items, int(maxConnectionsLimit))
	require.Equal(t, "", long3.Continue)

	require.Equal(t, items2500, slices.Concat(long1.Items, long2.Items, long3.Items))

	// you cannot go higher than MAX_CONNECTIONS_LIMIT
	limited := request(items2500, "/connections?limit=1500")
	require.Len(t, limited.Items, 1000)
	require.NotEqual(t, "", limited.Continue)
}

func TestGetConnectionsInvalidPagination(t *testing.T) {
	require.NoError(t, openfeature.SetProviderAndWait(memprovider.NewInMemoryProvider(map[string]memprovider.InMemoryFlag{
		featuremgmt.FlagQueryServiceWithConnections: {
			Key:            featuremgmt.FlagQueryServiceWithConnections,
			DefaultVariant: "enabled",
			Variants:       map[string]any{"enabled": true},
		},
	})))
	t.Cleanup(func() { require.NoError(t, openfeature.SetProviderAndWait(openfeature.NoopProvider{})) })

	provider := &testConnectionsProvider{list: &queryV1.DataSourceConnectionList{}}
	builder := &QueryAPIBuilder{instanceProvider: mockInstanceProvider{}, connections: provider}
	for _, url := range []string{
		"/connections?limit=abc", "/connections?limit=-1", "/connections?limit=9223372036854775808",
		"/connections?continue=bad", "/connections?continue=v1_-1", "/connections?continue=v1_2extra",
		"/connections?continue=v1_", "/connections?continue=v1_9223372036854775808",
	} {
		t.Run(url, func(t *testing.T) {
			r := mux.SetURLVars(httptest.NewRequest(http.MethodGet, url, nil), map[string]string{"namespace": "default"})
			w := httptest.NewRecorder()
			builder.GetConnections(w, r)
			require.Equal(t, http.StatusBadRequest, w.Code)
			require.Equal(t, 0, provider.calls)
		})
	}
}
