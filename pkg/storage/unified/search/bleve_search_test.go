package search

import (
	"context"
	"fmt"
	"log"
	"os"
	"testing"

	"github.com/blevesearch/bleve/v2"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/store/kind/dashboard"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func TestCanSearchByTitle(t *testing.T) {
	key := &resource.ResourceKey{
		Namespace: "default",
		Group:     "dashboard.grafana.app",
		Resource:  "dashboards",
	}

	t.Run("when query is empty, sort documents by title instead of search score", func(t *testing.T) {
		index := newTestDashboardsIndex(t)
		err := index.Write(&resource.IndexableDocument{
			RV:   1,
			Name: "name1",
			Key: &resource.ResourceKey{
				Name:      "name1",
				Namespace: key.Namespace,
				Group:     key.Group,
				Resource:  key.Resource,
			},
			Title: "bbb",
		})
		require.NoError(t, err)
		err = index.Write(&resource.IndexableDocument{
			RV:   1,
			Name: "name2",
			Key: &resource.ResourceKey{
				Name:      "name2",
				Namespace: key.Namespace,
				Group:     key.Group,
				Resource:  key.Resource,
			},
			Title: "aaa",
		})
		require.NoError(t, err)

		// search for phrase
		query := newQuery("")
		res, err := index.Search(context.Background(), nil, query, nil)
		require.NoError(t, err)
		require.Equal(t, int64(2), res.TotalHits)
		require.Equal(t, "name2", res.Results.Rows[0].Key.Name)
	})

	t.Run("will boost phrase match query over match query results", func(t *testing.T) {
		index := newTestDashboardsIndex(t)
		err := index.Write(&resource.IndexableDocument{
			RV:   1,
			Name: "name1",
			Key: &resource.ResourceKey{
				Name:      "name1",
				Namespace: key.Namespace,
				Group:     key.Group,
				Resource:  key.Resource,
			},
			Title: "I want to say a hello",
		})
		require.NoError(t, err)
		err = index.Write(&resource.IndexableDocument{
			RV:   1,
			Name: "name2",
			Key: &resource.ResourceKey{
				Name:      "name2",
				Namespace: key.Namespace,
				Group:     key.Group,
				Resource:  key.Resource,
			},
			Title: "we want hello",
		})
		require.NoError(t, err)

		// search for phrase
		query := newQuery("want hello")
		res, err := index.Search(context.Background(), nil, query, nil)
		require.NoError(t, err)
		require.Equal(t, int64(2), res.TotalHits)
		require.Equal(t, "name2", res.Results.Rows[0].Key.Name)
	})

	t.Run("will prioritize matches", func(t *testing.T) {
		index := newTestDashboardsIndex(t)
		err := index.Write(&resource.IndexableDocument{
			RV:   1,
			Name: "name1",
			Key: &resource.ResourceKey{
				Name:      "name1",
				Namespace: key.Namespace,
				Group:     key.Group,
				Resource:  key.Resource,
			},
			Title: "Asserts Dashboards",
		})
		require.NoError(t, err)
		err = index.Write(&resource.IndexableDocument{
			RV:   1,
			Name: "name2",
			Key: &resource.ResourceKey{
				Name:      "name2",
				Namespace: key.Namespace,
				Group:     key.Group,
				Resource:  key.Resource,
			},
			Title: "New dashboard 10",
		})
		require.NoError(t, err)

		query := newQuery("New dash")
		res, err := index.Search(context.Background(), nil, query, nil)
		require.NoError(t, err)
		require.Equal(t, int64(2), res.TotalHits)
		require.Equal(t, "name2", res.Results.Rows[0].Key.Name)
	})

	t.Run("will boost exact match query over match phrase query results", func(t *testing.T) {
		index := newTestDashboardsIndex(t)
		err := index.Write(&resource.IndexableDocument{
			RV:   1,
			Name: "name1",
			Key: &resource.ResourceKey{
				Name:      "name1",
				Namespace: key.Namespace,
				Group:     key.Group,
				Resource:  key.Resource,
			},
			Title: "we want hello pls",
		})
		require.NoError(t, err)
		err = index.Write(&resource.IndexableDocument{
			RV:   1,
			Name: "name2",
			Key: &resource.ResourceKey{
				Name:      "name2",
				Namespace: key.Namespace,
				Group:     key.Group,
				Resource:  key.Resource,
			},
			Title: "we want hello",
		})
		require.NoError(t, err)

		// search for exact match
		query := newQuery("we want hello")
		res, err := index.Search(context.Background(), nil, query, nil)
		require.NoError(t, err)
		require.Equal(t, int64(2), res.TotalHits)
		require.Equal(t, "name2", res.Results.Rows[0].Key.Name)
	})

	t.Run("title with numbers will match document", func(t *testing.T) {
		index := newTestDashboardsIndex(t)
		err := index.Write(&resource.IndexableDocument{
			RV:   1,
			Name: "name1",
			Key: &resource.ResourceKey{
				Name:      "aaa",
				Namespace: key.Namespace,
				Group:     key.Group,
				Resource:  key.Resource,
			},
			Title: "A123456",
		})
		require.NoError(t, err)

		// search for prefix of title with mix of chars and numbers
		query := newQuery("A12")
		res, err := index.Search(context.Background(), nil, query, nil)
		require.NoError(t, err)
		require.Equal(t, int64(1), res.TotalHits)

		// search for whole title
		query = newQuery("A123456")
		res, err = index.Search(context.Background(), nil, query, nil)
		require.NoError(t, err)
		require.Equal(t, int64(1), res.TotalHits)
	})

	t.Run("title search will match document", func(t *testing.T) {
		index := newTestDashboardsIndex(t)
		err := index.Write(&resource.IndexableDocument{
			RV:   1,
			Name: "name1",
			Key: &resource.ResourceKey{
				Name:      "aaa",
				Namespace: key.Namespace,
				Group:     key.Group,
				Resource:  key.Resource,
			},
			Title: "I want to say a wonderfully Hello to the WORLD! Hello-world",
		})
		require.NoError(t, err)

		// search by entire phrase
		query := newQuery("I want to say a wonderfully Hello to the WORLD! Hello-world")
		res, err := index.Search(context.Background(), nil, query, nil)
		require.NoError(t, err)
		require.Equal(t, int64(1), res.TotalHits)

		// search for word at start
		query = newQuery("hello")
		res, err = index.Search(context.Background(), nil, query, nil)
		require.NoError(t, err)
		require.Equal(t, int64(1), res.TotalHits)

		// search for word larger than ngram max size
		query = newQuery("wonderfully")
		res, err = index.Search(context.Background(), nil, query, nil)
		require.NoError(t, err)
		require.Equal(t, int64(1), res.TotalHits)

		// search for word at end
		query = newQuery("world")
		res, err = index.Search(context.Background(), nil, query, nil)
		require.NoError(t, err)
		require.Equal(t, int64(1), res.TotalHits)

		// can search for word substring anchored at start of word (edge ngram)
		query = newQuery("worl")
		res, err = index.Search(context.Background(), nil, query, nil)
		require.NoError(t, err)
		require.Equal(t, int64(1), res.TotalHits)

		// can search for multiple, non-consecutive words in title
		query = newQuery("hello world")
		res, err = index.Search(context.Background(), nil, query, nil)
		require.NoError(t, err)
		require.Equal(t, int64(1), res.TotalHits)

		// can search for a term with a hyphen
		query = newQuery("hello-world")
		res, err = index.Search(context.Background(), nil, query, nil)
		require.NoError(t, err)
		require.Equal(t, int64(1), res.TotalHits)
	})

	t.Run("title search will NOT match documents", func(t *testing.T) {
		index := newTestDashboardsIndex(t)
		err := index.Write(&resource.IndexableDocument{
			RV:   1,
			Name: "name1",
			Key: &resource.ResourceKey{
				Name:      "name1",
				Namespace: key.Namespace,
				Group:     key.Group,
				Resource:  key.Resource,
			},
			Title: "I want to say a wonderful Hello to the WORLD! Hello-world",
		})
		require.NoError(t, err)
		err = index.Write(&resource.IndexableDocument{
			RV:   1,
			Name: "name2",
			Key: &resource.ResourceKey{
				Name:      "name2",
				Namespace: key.Namespace,
				Group:     key.Group,
				Resource:  key.Resource,
			},
			Title: "A0456",
		})
		require.NoError(t, err)
		err = index.Write(&resource.IndexableDocument{
			RV:   1,
			Name: "name3",
			Key: &resource.ResourceKey{
				Name:      "name3",
				Namespace: key.Namespace,
				Group:     key.Group,
				Resource:  key.Resource,
			},
			Title: "mash-A02382-10",
		})
		require.NoError(t, err)

		// word that doesn't exist
		query := newQuery("cats")
		res, err := index.Search(context.Background(), nil, query, nil)
		require.NoError(t, err)
		require.Equal(t, int64(0), res.TotalHits)

		// string shorter than 3 chars (ngam min)
		query = newQuery("ma")
		res, err = index.Search(context.Background(), nil, query, nil)
		require.NoError(t, err)
		require.Equal(t, int64(0), res.TotalHits)

		// substring that doesn't exist
		query = newQuery("A01")
		res, err = index.Search(context.Background(), nil, query, nil)
		require.NoError(t, err)
		require.Equal(t, int64(0), res.TotalHits)
	})
}

func newQuery(query string) *resource.ResourceSearchRequest {
	return &resource.ResourceSearchRequest{
		Options: &resource.ListOptions{
			Key: &resource.ResourceKey{
				Namespace: "default",
				Group:     "dashboard.grafana.app",
				Resource:  "dashboards",
			},
		},
		Limit: 100000,
		Query: query,
	}
}

func newTestDashboardsIndex(t *testing.T) resource.ResourceIndex {
	key := &resource.ResourceKey{
		Namespace: "default",
		Group:     "dashboard.grafana.app",
		Resource:  "dashboards",
	}
	tmpdir, err := os.MkdirTemp("", "grafana-bleve-test")
	require.NoError(t, err)

	backend, err := NewBleveBackend(BleveOptions{
		Root:          tmpdir,
		FileThreshold: 9999, // use in-memory for tests
	}, tracing.NewNoopTracerService(), featuremgmt.WithFeatures(featuremgmt.FlagUnifiedStorageSearchPermissionFiltering))
	require.NoError(t, err)

	// AVOID NPE in test
	resource.NewIndexMetrics(backend.opts.Root, backend)

	rv := int64(10)
	ctx := identity.WithRequester(context.Background(), &user.SignedInUser{Namespace: "ns"})

	info, err := DashboardBuilder(func(ctx context.Context, namespace string, blob resource.BlobSupport) (resource.DocumentBuilder, error) {
		return &DashboardDocumentBuilder{
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
	}, 2, rv, info.Fields, func(index resource.ResourceIndex) (int64, error) { return 0, nil })
	require.NoError(t, err)

	return index
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
