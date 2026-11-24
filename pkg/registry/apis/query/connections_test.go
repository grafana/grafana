package query

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/mux"
	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	queryV1 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/user"
)

func enableConnections(t *testing.T) {
	t.Helper()
	require.NoError(t, openfeature.SetProviderAndWait(memprovider.NewInMemoryProvider(map[string]memprovider.InMemoryFlag{
		featuremgmt.FlagQueryServiceWithConnections: {
			Key:            featuremgmt.FlagQueryServiceWithConnections,
			DefaultVariant: "enabled",
			Variants:       map[string]any{"enabled": true},
		},
	})))
	t.Cleanup(func() { require.NoError(t, openfeature.SetProviderAndWait(openfeature.NoopProvider{})) })
}

func connectionRows(n int) []*datasources.DataSource {
	out := make([]*datasources.DataSource, n)
	for i := range out {
		out[i] = &datasources.DataSource{UID: fmt.Sprintf("n_%d", i), Name: fmt.Sprintf("Name %d", i), Type: "prometheus", OrgID: 1}
	}
	return out
}

func connectionNames(items []queryV1.DataSourceConnection) []string {
	out := make([]string, 0, len(items))
	for _, item := range items {
		out = append(out, item.Name)
	}
	return out
}

func rowNames(rows []*datasources.DataSource) []string {
	out := make([]string, 0, len(rows))
	for _, row := range rows {
		out = append(out, row.UID)
	}
	return out
}

func requestConnections(t *testing.T, rows []*datasources.DataSource, url string) (int, queryV1.DataSourceConnectionList) {
	t.Helper()
	r := mux.SetURLVars(httptest.NewRequest(http.MethodGet, url, nil), map[string]string{"namespace": "default"})
	r = r.WithContext(identity.WithRequester(r.Context(), &user.SignedInUser{OrgID: 1}))
	w := httptest.NewRecorder()

	builder := &QueryAPIBuilder{instanceProvider: mockInstanceProvider{}, lister: newTestLister(listerOptions{canRead: true, rows: rows})}
	builder.GetConnections(w, r)
	var result queryV1.DataSourceConnectionList
	if w.Code == http.StatusOK {
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &result))
	}
	return w.Code, result
}

func TestGetConnections(t *testing.T) {
	enableConnections(t)

	code, list := requestConnections(t, rows(), "/connections")
	require.Equal(t, http.StatusOK, code)
	require.Equal(t, "DataSourceConnectionList", list.Kind)
	require.Equal(t, queryV1.SchemeGroupVersion.String(), list.APIVersion)
	require.Equal(t, []queryV1.DataSourceConnection{
		{Title: "Loki", Name: "loki", APIGroup: "loki.datasource.grafana.app", Plugin: "loki", Labels: map[string]string{"grafana.app/deprecatedInternalID": "1"}},
		{Title: "Prometheus", Name: "prom", APIGroup: "prometheus.datasource.grafana.app", Plugin: "prometheus", Labels: map[string]string{"grafana.app/deprecatedInternalID": "2"}},
	}, list.Items, "the alias resolves to the plugin and the group label is not repeated")

	t.Run("by name", func(t *testing.T) {
		code, list := requestConnections(t, rows(), "/connections?name=prom")
		require.Equal(t, http.StatusOK, code)
		require.Equal(t, []string{"prom"}, connectionNames(list.Items))

		code, list = requestConnections(t, rows(), "/connections?name=nope")
		require.Equal(t, http.StatusOK, code)
		require.Empty(t, list.Items)
	})
}

func TestGetConnectionsPagination(t *testing.T) {
	enableConnections(t)

	request := func(rows []*datasources.DataSource, url string) queryV1.DataSourceConnectionList {
		t.Helper()
		code, list := requestConnections(t, rows, url)
		require.Equal(t, http.StatusOK, code)
		return list
	}

	// the max-limit is a high number (5000), so we need an array that is longer than that
	items14000 := connectionRows(14000)
	items3 := connectionRows(3)
	items0 := connectionRows(0)

	first := request(items3, "/connections?limit=2")
	require.Equal(t, rowNames(items3[:2]), connectionNames(first.Items))
	require.Equal(t, "v1_2", first.Continue)

	second := request(items3, "/connections?limit=2&continue="+first.Continue)
	require.Equal(t, rowNames(items3[2:]), connectionNames(second.Items))
	require.Equal(t, "", second.Continue)

	unlimited := request(items3, "/connections")
	require.Equal(t, rowNames(items3), connectionNames(unlimited.Items))
	require.Equal(t, "", unlimited.Continue)

	unlimited2 := request(items3, "/connections?limit=0")
	require.Equal(t, rowNames(items3), connectionNames(unlimited2.Items))
	require.Equal(t, "", unlimited2.Continue)

	exact := request(items3, "/connections?limit=3")
	require.Equal(t, rowNames(items3), connectionNames(exact.Items))
	require.Equal(t, "", exact.Continue)

	last := request(items3, "/connections?continue=v1_2")
	require.Equal(t, rowNames(items3[2:]), connectionNames(last.Items))
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
	long1 := request(items14000, "/connections")
	require.Len(t, long1.Items, int(maxConnectionsLimit))
	require.Equal(t, "v1_5000", long1.Continue)

	long2 := request(items14000, "/connections?continue="+long1.Continue)
	require.Len(t, long2.Items, int(maxConnectionsLimit))
	require.Equal(t, "v1_10000", long2.Continue)

	long3 := request(items14000, "/connections?continue="+long2.Continue)
	require.Len(t, long3.Items, 4000)
	require.Equal(t, "", long3.Continue)

	all := append(append(connectionNames(long1.Items), connectionNames(long2.Items)...), connectionNames(long3.Items)...)
	require.Equal(t, rowNames(items14000), all)

	// you cannot go higher than MAX_CONNECTIONS_LIMIT
	limited := request(items14000, "/connections?limit=5500")
	require.Len(t, limited.Items, 5000)
	require.NotEqual(t, "", limited.Continue)
}

func TestGetConnectionsInvalidPagination(t *testing.T) {
	enableConnections(t)

	for _, url := range []string{
		"/connections?limit=abc", "/connections?limit=-1", "/connections?limit=9223372036854775808",
		"/connections?continue=bad", "/connections?continue=v1_-1", "/connections?continue=v1_2extra",
		"/connections?continue=v1_", "/connections?continue=v1_9223372036854775808",
	} {
		t.Run(url, func(t *testing.T) {
			code, _ := requestConnections(t, nil, url)
			require.Equal(t, http.StatusBadRequest, code)
		})
	}
}
