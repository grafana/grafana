package vector

import (
	"encoding/json"
	"testing"
	"text/template"

	pgvector "github.com/pgvector/pgvector-go"

	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate/mocks"
)

func TestVectorQueries(t *testing.T) {
	mocks.CheckQuerySnapshots(t, mocks.TemplateTestSetup{
		RootDir:        "testdata",
		SQLTemplatesFS: sqlTemplatesFS,
		Dialects:       []sqltemplate.Dialect{sqltemplate.PostgreSQL},
		Templates: map[*template.Template][]mocks.TemplateTestCase{
			sqlEmbeddingsUpsert: {
				{
					Name: "simple",
					Data: &sqlEmbeddingsUpsertRequest{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Vector: &Vector{
							Namespace:       "stacks-123",
							Group:           "dashboard.grafana.app",
							Resource:        "dashboards",
							Name:            "abc-uid",
							Subresource:     "panel/5",
							ResourceVersion: 42,
							Folder:          "folder-uid",
							Content:         "panel title with queries",
							Metadata:        json.RawMessage(`{"datasource_uids":["ds1"]}`),
							Embedding:       []float32{0.1, 0.2, 0.3},
							Model:           "text-embedding-005",
						},
						Embedding: pgvector.NewHalfVector([]float32{0.1, 0.2, 0.3}),
					},
				},
			},
			sqlEmbeddingsDelete: {
				{
					Name: "delete all",
					Data: &sqlEmbeddingsDeleteRequest{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Namespace:   "stacks-123",
						Group:       "dashboard.grafana.app",
						Resource:    "dashboards",
						Name:        "abc-uid",
						OlderThanRV: 0,
					},
				},
				{
					Name: "delete stale",
					Data: &sqlEmbeddingsDeleteRequest{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Namespace:   "stacks-123",
						Group:       "dashboard.grafana.app",
						Resource:    "dashboards",
						Name:        "abc-uid",
						OlderThanRV: 42,
					},
				},
			},
			sqlEmbeddingsSearch: {
				{
					Name: "no filters",
					Data: &sqlEmbeddingsSearchRequest{
						SQLTemplate:    mocks.NewTestingSQLTemplate(),
						Namespace:      "stacks-123",
						Group:          "dashboard.grafana.app",
						Resource:       "dashboards",
						QueryEmbedding: []float32{0.1, 0.2, 0.3},
						Limit:          10,
						Response:       &sqlEmbeddingsSearchResponse{},
					},
				},
				{
					Name: "with name filter",
					Data: &sqlEmbeddingsSearchRequest{
						SQLTemplate:    mocks.NewTestingSQLTemplate(),
						Namespace:      "stacks-123",
						Group:          "dashboard.grafana.app",
						Resource:       "dashboards",
						QueryEmbedding: []float32{0.1, 0.2, 0.3},
						Limit:          10,
						NameValues:     []string{"dash-1", "dash-2"},
						Response:       &sqlEmbeddingsSearchResponse{},
					},
				},
				{
					Name: "with all filters",
					Data: &sqlEmbeddingsSearchRequest{
						SQLTemplate:      mocks.NewTestingSQLTemplate(),
						Namespace:        "stacks-123",
						Group:            "dashboard.grafana.app",
						Resource:         "dashboards",
						QueryEmbedding:   []float32{0.1, 0.2, 0.3},
						Limit:            5,
						NameValues:       []string{"dash-1"},
						FolderValues:     []string{"folder-a", "folder-b"},
						MetadataFilters: []MetadataFilterEntry{
							{JSON: `{"datasource_uids":["ds-uid-1"]}`},
							{JSON: `{"query_languages":["promql"]}`},
						},
						Response:         &sqlEmbeddingsSearchResponse{},
					},
				},
			},
			sqlEmbeddingsGetLatestRV: {
				{
					Name: "simple",
					Data: &sqlEmbeddingsGetLatestRVRequest{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Namespace:   "stacks-123",
						Response:    &sqlEmbeddingsGetLatestRVResponse{},
					},
				},
			},
			sqlEmbeddingsCreatePartition: {
				{
					Name: "simple",
					Data: &sqlEmbeddingsCreatePartitionRequest{
						SQLTemplate:   mocks.NewTestingSQLTemplate(),
						Namespace:     "stacks-123",
						PartitionName: "resource_embeddings_stacks_123",
					},
				},
			},
		},
	})
}
