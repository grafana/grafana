package search

import (
	"testing"

	"github.com/grafana/grafana/pkg/services/store/kind/dashboard"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func TestDashboardDocumentBuilder(t *testing.T) {
	key := &resource.ResourceKey{
		Namespace: "default",
		Group:     "dashboard.grafana.app",
		Resource:  "dashboards",
	}

	builder := &DashboardDocumentBuilder{
		Namespace: key.Namespace,
		Stats: map[string]map[string]int64{
			"x": {
				"y": 125,
			},
		},
		Lookup: dashboard.CreateDatasourceLookup([]*dashboard.DatasourceQueryResult{
			// empty for now
		}),
		Blob: nil, // not testing this yet
	}

	testDocumentBuilder(t, testBuilderOptions{
		key:     key,
		prefix:  "dashboard",
		names:   []string{"aaa"},
		builder: builder,
	})
}
