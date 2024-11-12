package search

import (
	"context"
	"encoding/json"
	"log/slog"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/experimental"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func TestBleveBackend(t *testing.T) {
	key := &resource.ResourceKey{
		Namespace: "default",
		Group:     "dashboard.grafana.app",
		Resource:  "dashboards",
	}
	tmpdir, err := os.CreateTemp("", "bleve-test")
	require.NoError(t, err)

	backend := &bleveBackend{
		tracer: tracing.NewNoopTracerService(),
		log:    slog.Default(),
		opts: bleveOptions{
			Root:          tmpdir.Name(),
			FileThreshold: 5,
		},
		cache: make(map[resource.NamespacedResource]*bleveIndex),
	}

	rv := int64(10)
	ctx := context.Background()
	index, err := backend.BuildIndex(ctx, resource.NamespacedResource{
		Namespace: key.Namespace,
		Group:     key.Group,
		Resource:  key.Resource,
	}, 2, rv, func(index resource.ResourceIndex) (int64, error) {
		index.Write(&StandardDocumentFields{
			ID:         "aaa",
			RV:         1,
			Name:       "aaa",
			Folder:     "folder-1",
			OriginName: "SQL",
			Tags:       []string{"aa", "bb"},
			Created:    time.Unix(10000, 0), // searchable, but not stored!!! (by default)
		})
		index.Write(&StandardDocumentFields{
			ID:         "bbb",
			RV:         2,
			Name:       "bbb",
			Folder:     "folder-2",
			OriginName: "SQL",
			Tags:       []string{"aa"},
			Labels: map[string]string{
				"key": "value",
			},
		})
		index.Write(&StandardDocumentFields{
			ID:         "ccc",
			RV:         3,
			Name:       "ccc",
			Folder:     "folder-1",
			OriginName: "SQL",
			Tags:       []string{"aa"},
			Labels: map[string]string{
				"key": "value",
			},
		})
		return rv, nil
	})
	require.NoError(t, err)
	require.NotNil(t, index)

	rsp, err := index.Search(ctx, nil, &resource.ResourceSearchRequest{
		Query: "*",
		Limit: 100000,
		Facet: map[string]*resource.ResourceSearchRequest_Facet{
			"tags": {
				Field: "tags",
				Limit: 100,
			},
		},
	})
	require.NoError(t, err)
	require.Nil(t, rsp.Error)
	require.NotNil(t, rsp.Frame)
	require.NotNil(t, rsp.Facet)

	// Get the tags facets
	facet, ok := rsp.Facet["tags"]
	require.True(t, ok)
	disp, err := json.MarshalIndent(facet, "", "  ")
	require.NoError(t, err)
	//fmt.Printf("%s\n", disp)
	require.JSONEq(t, `{
		"field": "tags",
		"total": 4,
		"terms": [
			{
				"term": "aa",
				"count": 3
			},
			{
				"term": "bb",
				"count": 1
			}
		]
	}`, string(disp))

	frame := &data.Frame{}
	err = frame.UnmarshalJSON(rsp.Frame)
	require.NoError(t, err)

	// Verify the results in testdata
	experimental.CheckGoldenJSONFrame(t, "testdata", "golden-simple", frame, true)
}
