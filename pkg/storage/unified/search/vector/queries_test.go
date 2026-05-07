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
			sqlVectorCollectionUpsert: {
				{
					Name: "simple",
					Data: &sqlVectorCollectionUpsertRequest{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Resource:    "dashboards",
						Vector: &Vector{
							Namespace:       "stacks-123",
							Resource:        "dashboards",
							UID:             "abc-uid",
							Title:           "CPU Dashboard",
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
			sqlVectorCollectionDelete: {
				{
					Name: "simple",
					Data: &sqlVectorCollectionDeleteRequest{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Resource:    "dashboards",
						Namespace:   "stacks-123",
						Model:       "text-embedding-005",
						UID:         "abc-uid",
					},
				},
			},
			sqlVectorCollectionDeleteSubresource: {
				{
					Name: "simple",
					Data: &sqlVectorCollectionDeleteSubresourcesRequest{
						SQLTemplate:  mocks.NewTestingSQLTemplate(),
						Resource:     "dashboards",
						Namespace:    "stacks-123",
						Model:        "text-embedding-005",
						UID:          "abc-uid",
						Subresources: []string{"panel/1", "panel/2"},
					},
				},
			},
			sqlVectorCollectionGetContent: {
				{
					Name: "simple",
					Data: &sqlVectorCollectionGetContentRequest{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Resource:    "dashboards",
						Namespace:   "stacks-123",
						Model:       "text-embedding-005",
						UID:         "abc-uid",
						Response:    &sqlVectorCollectionGetContentResponse{},
					},
				},
			},
			sqlVectorCollectionSearch: {
				{
					Name: "no filters",
					Data: &sqlVectorCollectionSearchRequest{
						SQLTemplate:    mocks.NewTestingSQLTemplate(),
						Resource:       "dashboards",
						Namespace:      "stacks-123",
						Model:          "text-embedding-005",
						QueryEmbedding: []float32{0.1, 0.2, 0.3},
						Limit:          10,
						Response:       &sqlVectorCollectionSearchResponse{},
					},
				},
				{
					Name: "with uid filter",
					Data: &sqlVectorCollectionSearchRequest{
						SQLTemplate:    mocks.NewTestingSQLTemplate(),
						Resource:       "dashboards",
						Namespace:      "stacks-123",
						Model:          "text-embedding-005",
						QueryEmbedding: []float32{0.1, 0.2, 0.3},
						Limit:          10,
						UIDValues:      []string{"dash-1", "dash-2"},
						Response:       &sqlVectorCollectionSearchResponse{},
					},
				},
				{
					Name: "with all filters",
					Data: &sqlVectorCollectionSearchRequest{
						SQLTemplate:    mocks.NewTestingSQLTemplate(),
						Resource:       "dashboards",
						Namespace:      "stacks-123",
						Model:          "text-embedding-005",
						QueryEmbedding: []float32{0.1, 0.2, 0.3},
						Limit:          5,
						UIDValues:      []string{"dash-1"},
						FolderValues:   []string{"folder-a", "folder-b"},
						MetadataFilters: []MetadataFilterEntry{
							{JSON: `{"datasource_uids":["ds-uid-1"]}`},
							{JSON: `{"query_languages":["promql"]}`},
						},
						Response: &sqlVectorCollectionSearchResponse{},
					},
				},
			},
		},
	})
}
