//go:build integration

package search_test

import (
	"context"
	"os"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search"
)

func TestElasticSearchEngineIntegration(t *testing.T) {
	addr := os.Getenv("GRAFANA_ES_ADDRESS")
	if addr == "" {
		t.Skip("set GRAFANA_ES_ADDRESS to run elasticsearch integration tests")
	}
	eng := search.NewElasticSearchEngine([]string{addr}, "grafana-test")
	key := &resourcepb.ResourceIndexKey{Namespace: "default", Group: "dashboard.grafana.app", Resource: "dashboards"}
	schema := []*resourcepb.FieldDescriptor{{
		Name:         "tags",
		Type:         resourcepb.FieldType_FIELD_TYPE_STRING,
		Array:        true,
		Capabilities: []resourcepb.Capability{resourcepb.Capability_CAPABILITY_FILTER},
	}}
	_, err := eng.Index(context.Background(), &resourcepb.IndexRequest{
		Index:      key,
		Schema:     schema,
		SchemaHash: "integration-test",
		Items: []*resourcepb.IndexItem{{
			Action: resourcepb.IndexItem_ACTION_UPSERT,
			Doc: &resourcepb.Document{
				Key:    &resourcepb.ResourceKey{Namespace: key.Namespace, Group: key.Group, Resource: key.Resource, Name: "d1"},
				Title:  "Integration CPU",
				Folder: "general",
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

	_, err = eng.DeleteIndex(context.Background(), &resourcepb.DeleteIndexRequest{Index: key})
	require.NoError(t, err)
}
