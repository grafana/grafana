package search_test

import (
	"context"
	"fmt"
	"log"
	"testing"

	"github.com/blevesearch/bleve/v2"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/store/kind/dashboard"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search"
)

const threshold = 9999

func indexDocumentsWithTitles(t *testing.T, index resource.ResourceIndex, key resource.NamespacedResource, docsWithTitles map[string]string) {
	var result []*resource.BulkIndexItem

	for name, title := range docsWithTitles {
		result = append(result, &resource.BulkIndexItem{
			Action: resource.ActionIndex,
			Doc: &resource.IndexableDocument{
				RV:   1,
				Name: name,
				Key: &resourcepb.ResourceKey{
					Name:      name,
					Namespace: key.Namespace,
					Group:     key.Group,
					Resource:  key.Resource,
				},
				Title: title,
			},
		})
	}
	req := &resource.BulkIndexRequest{Items: result}
	require.NoError(t, index.BulkIndex(req))
}

func TestCanSearchByTitle(t *testing.T) {
	key := resource.NamespacedResource{
		Namespace: "default",
		Group:     "dashboard.grafana.app",
		Resource:  "dashboards",
	}

	t.Run("when query is empty, sort documents by title instead of search score", func(t *testing.T) {
		index := newTestDashboardsIndex(t, threshold, 2, 2, noop)
		indexDocumentsWithTitles(t, index, key, map[string]string{
			"name1": "bbb",
			"name2": "aaa",
		})

		// search for phrase
		query := newTestQuery("")
		res, err := index.Search(context.Background(), nil, query, nil)
		require.NoError(t, err)
		require.Equal(t, int64(2), res.TotalHits)
		require.Equal(t, "name2", res.Results.Rows[0].Key.Name)
	})

	t.Run("will boost phrase match query over match query results", func(t *testing.T) {
		index := newTestDashboardsIndex(t, threshold, 2, 2, noop)
		indexDocumentsWithTitles(t, index, key, map[string]string{
			"name1": "I want to say a hello",
			"name2": "we want hello",
		})

		// search for phrase
		query := newTestQuery("want hello")
		res, err := index.Search(context.Background(), nil, query, nil)
		require.NoError(t, err)
		require.Equal(t, int64(2), res.TotalHits)
		require.Equal(t, "name2", res.Results.Rows[0].Key.Name)
	})

	t.Run("will prioritize matches", func(t *testing.T) {
		index := newTestDashboardsIndex(t, threshold, 2, 2, noop)
		indexDocumentsWithTitles(t, index, key, map[string]string{
			"name1": "Asserts Dashboards",
			"name2": "New dashboard 10",
		})

		query := newTestQuery("New dash")
		res, err := index.Search(context.Background(), nil, query, nil)
		require.NoError(t, err)
		require.Equal(t, int64(2), res.TotalHits)
		require.Equal(t, "name2", res.Results.Rows[0].Key.Name)
	})

	t.Run("will boost exact match query over match phrase query results", func(t *testing.T) {
		index := newTestDashboardsIndex(t, threshold, 2, 2, noop)
		indexDocumentsWithTitles(t, index, key, map[string]string{
			"name1": "we want hello pls",
			"name2": "we want hello",
		})

		// search for exact match
		query := newTestQuery("we want hello")
		res, err := index.Search(context.Background(), nil, query, nil)
		require.NoError(t, err)
		require.Equal(t, int64(2), res.TotalHits)
		require.Equal(t, "name2", res.Results.Rows[0].Key.Name)
	})

	t.Run("title with numbers will match document", func(t *testing.T) {
		index := newTestDashboardsIndex(t, threshold, 2, 2, noop)
		indexDocumentsWithTitles(t, index, key, map[string]string{
			"name1": "A123456",
		})

		// search for prefix of title with mix of chars and numbers
		query := newQueryByTitle("A12")
		res, err := index.Search(context.Background(), nil, query, nil)
		require.NoError(t, err)
		require.Equal(t, int64(1), res.TotalHits)

		// search for whole title
		query = newQueryByTitle("A123456")
		res, err = index.Search(context.Background(), nil, query, nil)
		require.NoError(t, err)
		require.Equal(t, int64(1), res.TotalHits)

		// case insensive search for partial title
		query = newQueryByTitle("a1234")
		res, err = index.Search(context.Background(), nil, query, nil)
		require.NoError(t, err)
		require.Equal(t, int64(1), res.TotalHits)
	})

	t.Run("title will match escaped characters", func(t *testing.T) {
		index := newTestDashboardsIndex(t, threshold, 2, 2, noop)
		indexDocumentsWithTitles(t, index, key, map[string]string{
			"name1": "what\"s up",
			"name2": "what\"s that",
		})

		query := newQueryByTitle("what\"s up")
		res, err := index.Search(context.Background(), nil, query, nil)
		require.NoError(t, err)
		require.Equal(t, int64(1), res.TotalHits)

		query = newQueryByTitle("what\"s")
		res, err = index.Search(context.Background(), nil, query, nil)
		require.NoError(t, err)
		require.Equal(t, int64(2), res.TotalHits)
	})

	t.Run("title search will match document", func(t *testing.T) {
		index := newTestDashboardsIndex(t, threshold, 2, 2, noop)
		indexDocumentsWithTitles(t, index, key, map[string]string{
			"name1": "I want to say a wonderfully Hello to the WORLD! Hello-world",
		})

		// search by entire phrase
		query := newTestQuery("I want to say a wonderfully Hello to the WORLD! Hello-world")
		res, err := index.Search(context.Background(), nil, query, nil)
		require.NoError(t, err)
		require.Equal(t, int64(1), res.TotalHits)

		// search for word at start
		query = newTestQuery("hello")
		res, err = index.Search(context.Background(), nil, query, nil)
		require.NoError(t, err)
		require.Equal(t, int64(1), res.TotalHits)

		// search for word larger than ngram max size
		query = newQueryByTitle("wonderfully")
		res, err = index.Search(context.Background(), nil, query, nil)
		require.NoError(t, err)
		require.Equal(t, int64(1), res.TotalHits)

		// search for word at end
		query = newQueryByTitle("world")
		res, err = index.Search(context.Background(), nil, query, nil)
		require.NoError(t, err)
		require.Equal(t, int64(1), res.TotalHits)

		// can search for word substring anchored at start of word (edge ngram)
		query = newQueryByTitle("worl")
		res, err = index.Search(context.Background(), nil, query, nil)
		require.NoError(t, err)
		require.Equal(t, int64(1), res.TotalHits)

		// can search for multiple, non-consecutive words in title
		query = newQueryByTitle("hello world")
		res, err = index.Search(context.Background(), nil, query, nil)
		require.NoError(t, err)
		require.Equal(t, int64(1), res.TotalHits)

		// can search for a term with a hyphen
		query = newQueryByTitle("hello-world")
		res, err = index.Search(context.Background(), nil, query, nil)
		require.NoError(t, err)
		require.Equal(t, int64(1), res.TotalHits)
	})

	t.Run("title search will NOT match documents", func(t *testing.T) {
		index := newTestDashboardsIndex(t, threshold, 2, 2, noop)
		indexDocumentsWithTitles(t, index, key, map[string]string{
			"name1": "I want to say a wonderfully Hello to the WORLD! Hello-world",
			"name2": "A0456",
			"name3": "mash-A02382-10",
		})

		// word that doesn't exist
		query := newQueryByTitle("cats")
		res, err := index.Search(context.Background(), nil, query, nil)
		require.NoError(t, err)
		require.Equal(t, int64(0), res.TotalHits)

		// string shorter than 3 chars (ngam min)
		query = newQueryByTitle("ma")
		res, err = index.Search(context.Background(), nil, query, nil)
		require.NoError(t, err)
		require.Equal(t, int64(0), res.TotalHits)

		// substring that doesn't exist
		query = newQueryByTitle("A01")
		res, err = index.Search(context.Background(), nil, query, nil)
		require.NoError(t, err)
		require.Equal(t, int64(0), res.TotalHits)
	})

	t.Run("title search with character will match one document", func(t *testing.T) {
		index := newTestDashboardsIndex(t, threshold, 2, 2, noop)
		indexDocumentsWithTitles(t, index, key, map[string]string{
			"name1": "foo",
		})

		for i, v := range search.TermCharacters {
			err := index.BulkIndex(&resource.BulkIndexRequest{
				Items: []*resource.BulkIndexItem{
					{
						Action: resource.ActionIndex,
						Doc: &resource.IndexableDocument{
							RV:   int64(i),
							Name: fmt.Sprintf("name%d", i),
							Key: &resourcepb.ResourceKey{
								Name:      fmt.Sprintf("name%d", i),
								Namespace: key.Namespace,
								Group:     key.Group,
								Resource:  key.Resource,
							},
							Title: fmt.Sprintf(`test foo%d%sbar`, i, v),
						},
					},
				},
			})
			require.NoError(t, err)

			title := fmt.Sprintf(`test foo%d%sbar`, i, v)
			query := newQueryByTitle(title)
			res, err := index.Search(context.Background(), nil, query, nil)
			require.NoError(t, err)
			if res.TotalHits != 1 {
				t.Logf("i: %d, v: %s, title: %s", i, v, title)
			}
			require.Equal(t, int64(1), res.TotalHits)

			// can search for a title with a term character suffix
			title = fmt.Sprintf(`foo%d%s`, i, v)
			query = newQueryByTitle(title)
			res, err = index.Search(context.Background(), nil, query, nil)
			require.NoError(t, err)
			if res.TotalHits != 1 {
				t.Logf("i: %d, v: %s, title: %s\n", i, v, title)
			}

			require.Equal(t, int64(1), res.TotalHits)
		}
	})
}

func newTestQuery(query string) *resourcepb.ResourceSearchRequest {
	return &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Namespace: "default",
				Group:     "dashboard.grafana.app",
				Resource:  "dashboards",
			},
		},
		Limit: 100000,
		Query: query,
	}
}

func newQueryByTitle(query string) *resourcepb.ResourceSearchRequest {
	return &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Namespace: "default",
				Group:     "dashboard.grafana.app",
				Resource:  "dashboards",
			},
			Fields: []*resourcepb.Requirement{{Key: "title", Operator: "=", Values: []string{query}}},
		},
		Limit: 100000,
	}
}

func newTestDashboardsIndex(t testing.TB, threshold int64, size int64, batchSize int64, writer resource.BuildFn) resource.ResourceIndex {
	key := &resourcepb.ResourceKey{
		Namespace: "default",
		Group:     "dashboard.grafana.app",
		Resource:  "dashboards",
	}
	backend, err := search.NewBleveBackend(search.BleveOptions{
		Root:          t.TempDir(),
		FileThreshold: threshold, // use in-memory for tests
		BatchSize:     int(batchSize),
	}, tracing.NewNoopTracerService(), featuremgmt.WithFeatures(), nil)
	require.NoError(t, err)

	t.Cleanup(backend.CloseAllIndexes)

	rv := int64(10)
	ctx := identity.WithRequester(context.Background(), &user.SignedInUser{Namespace: "ns"})

	info, err := search.DashboardBuilder(func(ctx context.Context, namespace string, blob resource.BlobSupport) (resource.DocumentBuilder, error) {
		return &search.DashboardDocumentBuilder{
			Namespace:        namespace,
			Blob:             blob,
			Stats:            make(map[string]map[string]int64), // empty stats
			DatasourceLookup: dashboard.CreateDatasourceLookup([]*dashboard.DatasourceQueryResult{{}}),
		}, nil
	})
	require.NoError(t, err)

	index, err := backend.BuildIndex(ctx, resource.NamespacedResource{
		Namespace: key.Namespace,
		Group:     key.Group,
		Resource:  key.Resource,
	}, size, rv, info.Fields, "test", writer, nil, false, false)
	require.NoError(t, err)

	return index
}

var noop resource.BuildFn = func(index resource.ResourceIndex) (int64, error) {
	return 0, nil
}

// helper to check which tokens are generated by an analyzer
// nolint:unused
func debugAnalyzer(index bleve.Index, analyzerName string, text string) {
	// Get the analyzer (default: "standard")
	analyzer := index.Mapping().AnalyzerNamed(analyzerName)
	if analyzer == nil {
		log.Fatal("Analyzer not found")
	}

	// Analyze text to see generated tokens
	analysisResult := analyzer.Analyze([]byte(text))

	// Print tokens
	fmt.Println("Generated tokens for analyzer:", analyzerName)
	for _, token := range analysisResult {
		fmt.Println(string(token.Term))
	}
}

// helper to check which terms are indexed for a field
// nolint:unused
func debugIndexedTerms(index bleve.Index, field string) {
	// Check what terms exist for the title field
	fieldTerms, err := index.FieldDict(field)
	if err != nil {
		log.Fatal(err)
	}

	for {
		term, err := fieldTerms.Next()
		if err != nil {
			break
		}
		if term != nil {
			fmt.Println(term.Term)
		}
	}
}
