package vector

import (
	"database/sql"
	"encoding/json"
	"testing"
	"text/template"
	"time"

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
			sqlVectorNamespaceDeleteEmbeddings: {
				{
					Name: "simple",
					Data: &sqlVectorNamespaceDeleteRequest{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Namespace:   "stacks-123",
					},
				},
			},
			sqlVectorNamespaceDeleteQueryCache: {
				{
					Name: "simple",
					Data: &sqlVectorNamespaceDeleteRequest{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Namespace:   "stacks-123",
					},
				},
			},
			sqlVectorNamespaceDeleteRateBuckets: {
				{
					Name: "simple",
					Data: &sqlVectorNamespaceDeleteRequest{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Namespace:   "stacks-123",
					},
				},
			},
			sqlVectorNamespaceDeletePromoted: {
				{
					Name: "simple",
					Data: &sqlVectorNamespaceDeleteRequest{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Namespace:   "stacks-123",
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
			sqlVectorCollectionExists: {
				{
					Name: "simple",
					Data: &sqlVectorCollectionExistsRequest{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Resource:    "dashboards",
						Namespace:   "stacks-123",
						Model:       "text-embedding-005",
						UID:         "abc-uid",
						Response:    &sqlVectorCollectionExistsResponse{},
					},
				},
			},
			sqlVectorBackfillJobsList: {
				{
					Name: "simple",
					Data: &sqlVectorBackfillJobsListRequest{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Model:       "text-embedding-005",
						Response:    &sqlVectorBackfillJobsListResponse{},
					},
				},
			},
			sqlVectorBackfillJobsCreate: {
				{
					Name: "simple",
					Data: &sqlVectorBackfillJobsCreateRequest{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Model:       "text-embedding-005",
						Resource:    "dashboards",
						StoppingRV:  12345,
					},
				},
			},
			sqlVectorBackfillJobsUpdate: {
				{
					Name: "simple",
					Data: &sqlVectorBackfillJobsUpdateRequest{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						ID:          7,
						LastSeenKey: sql.NullString{String: "tok-42", Valid: true},
						LastError:   sql.NullString{},
					},
				},
			},
			sqlVectorBackfillJobsSetError: {
				{
					Name: "simple",
					Data: &sqlVectorBackfillJobsSetErrorRequest{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						ID:          7,
						LastError:   sql.NullString{String: "boom", Valid: true},
					},
				},
			},
			sqlVectorBackfillJobsComplete: {
				{
					Name: "simple",
					Data: &sqlVectorBackfillJobsCompleteRequest{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						ID:          7,
					},
				},
			},
			sqlQueryCacheGet: {
				{
					Name: "simple",
					Data: &sqlQueryCacheGetRequest{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Namespace:   "stacks-123",
						Model:       "text-embedding-005",
						QueryHash:   "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
						Response:    &sqlQueryCacheGetResponse{},
					},
				},
			},
			sqlQueryCacheCount: {
				{
					Name: "simple",
					Data: &sqlQueryCacheCountRequest{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Namespace:   "stacks-123",
						Response:    &sqlQueryCacheCountResponse{},
					},
				},
			},
			sqlQueryCacheEvictOldest: {
				{
					Name: "simple",
					Data: &sqlQueryCacheEvictOldestRequest{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Namespace:   "stacks-123",
						Limit:       5,
					},
				},
			},
			sqlQueryCacheInsert: {
				{
					Name: "simple",
					Data: &sqlQueryCacheInsertRequest{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Namespace:   "stacks-123",
						Model:       "text-embedding-005",
						QueryHash:   "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
						Embedding:   pgvector.NewHalfVector([]float32{0.1, 0.2, 0.3}),
					},
				},
			},
			sqlRateBucketIncrement: {
				{
					Name: "simple",
					Data: &sqlRateBucketIncrementRequest{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Namespace:   "stacks-123",
						WindowStart: time.Date(2026, 5, 20, 12, 0, 0, 0, time.UTC),
						Response:    &sqlRateBucketIncrementResponse{},
					},
				},
			},
			sqlRateBucketSweep: {
				{
					Name: "simple",
					Data: &sqlRateBucketSweepRequest{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Cutoff:      time.Date(2026, 5, 20, 11, 58, 0, 0, time.UTC),
					},
				},
			},
			sqlVectorCatalogList: {
				{
					Name: "simple",
					Data: &sqlVectorCatalogListRequest{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Response:    &sqlVectorCatalogListResponse{},
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
