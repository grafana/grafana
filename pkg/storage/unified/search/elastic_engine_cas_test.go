package search

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestElasticSearchEngineIndexCASBulkBody(t *testing.T) {
	var bulkBody string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodHead:
			w.WriteHeader(http.StatusNotFound)
		case r.Method == http.MethodPut && strings.HasSuffix(r.URL.Path, "/_mapping"):
			w.WriteHeader(http.StatusOK)
		case r.Method == http.MethodPut:
			w.WriteHeader(http.StatusOK)
		case r.Method == http.MethodPost && strings.Contains(r.URL.Path, "/_bulk"):
			body, err := io.ReadAll(r.Body)
			require.NoError(t, err)
			bulkBody = string(body)
			require.Equal(t, "wait_for", r.URL.Query().Get("refresh"))
			_, _ = w.Write([]byte(`{"errors":false,"items":[{"index":{"status":201}},{"delete":{"status":200}}]}`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(srv.Close)

	eng := NewElasticSearchEngine([]string{srv.URL}, "grafana-test")
	key := &resourcepb.ResourceKey{
		Namespace: "default",
		Group:     "dashboard.grafana.app",
		Resource:  "dashboards",
		Name:      "d1",
	}
	_, err := eng.Index(context.Background(), &resourcepb.IndexRequest{
		Index: &resourcepb.ResourceIndexKey{
			Namespace: key.Namespace,
			Group:     key.Group,
			Resource:  key.Resource,
		},
		Items: []*resourcepb.IndexItem{
			{
				Action: resourcepb.IndexItem_ACTION_UPSERT,
				Doc: &resourcepb.Document{
					Key:             key,
					Title:           "CPU",
					ResourceVersion: 100,
				},
			},
			{
				Action: resourcepb.IndexItem_ACTION_DELETE,
				Doc: &resourcepb.Document{
					Key:             key,
					ResourceVersion: 101,
				},
			},
		},
	})
	require.NoError(t, err)
	require.Contains(t, bulkBody, `"version":100`)
	require.Contains(t, bulkBody, `"version":101`)
	require.Contains(t, bulkBody, `"version_type":"external_gte"`)
}
