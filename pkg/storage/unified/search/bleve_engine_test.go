package search_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search"
)

func TestBleveSearchEngineIndexAndSearch(t *testing.T) {
	backend, err := search.NewBleveBackend(search.BleveOptions{
		Root:          t.TempDir(),
		FileThreshold: 9999,
	}, nil)
	require.NoError(t, err)
	t.Cleanup(backend.Stop)

	eng := search.NewBleveSearchEngine(backend)
	key := &resourcepb.ResourceIndexKey{Namespace: "default", Group: "dashboard.grafana.app", Resource: "dashboards"}
	schema := []*resourcepb.FieldDescriptor{{
		Name:         "tags",
		Type:         resourcepb.FieldType_FIELD_TYPE_STRING,
		Array:        true,
		Capabilities: []resourcepb.Capability{resourcepb.Capability_CAPABILITY_FILTER, resourcepb.Capability_CAPABILITY_RETRIEVE},
	}}
	_, err = eng.Index(context.Background(), &resourcepb.IndexRequest{
		Index:      key,
		Schema:     schema,
		SchemaHash: "test-schema",
		Items: []*resourcepb.IndexItem{{
			Action: resourcepb.IndexItem_ACTION_UPSERT,
			Doc: &resourcepb.Document{
				Key:    &resourcepb.ResourceKey{Namespace: key.Namespace, Group: key.Group, Resource: key.Resource, Name: "d1"},
				Title:  "CPU Usage",
				Folder: "platform",
			},
		}},
	})
	require.NoError(t, err)

	rsp, err := eng.Search(context.Background(), &resourcepb.SearchRequest{
		Index: key,
		Query: &resourcepb.Query{Text: []*resourcepb.TextPredicate{{Value: "cpu", Fields: []string{"title"}}}},
		Limit: 10,
		Authz: &resourcepb.AuthzFilter{All: true},
	}, nil)
	require.NoError(t, err)
	require.Nil(t, rsp.Error)
	require.GreaterOrEqual(t, rsp.TotalHits, int64(1))
}
