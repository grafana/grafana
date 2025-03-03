package search

import (
	"context"
	"fmt"
	"log"
	"os"
	"testing"

	"github.com/blevesearch/bleve/v2"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/store/kind/dashboard"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/stretchr/testify/require"
)

func debugAnalyzer(index bleve.Index, analyzerName string, text string) {
	// Get the analyzer (default: "standard")
	analyzer := index.Mapping().AnalyzerNamed(analyzerName)
	if analyzer == nil {
		log.Fatal("Analyzer not found")
	}

	// Analyze text to see generated tokens
	analysisResult := analyzer.Analyze([]byte(text))

	// Print tokens
	fmt.Println("Generated tokens:")
	for _, token := range analysisResult {
		fmt.Println(string(token.Term))
	}
}

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

func TestCanSearchByTitle(t *testing.T) {
	key := &resource.ResourceKey{
		Namespace: "default",
		Group:     "dashboard.grafana.app",
		Resource:  "dashboards",
	}

	t.Run("can find by words in title", func(t *testing.T) {
		index := newTestDashboardsIndex(t)

		analyzer := index.(*bleveIndex).index.Mapping().AnalyzerNamed(TITLE_ANALYZER)
		analyzer.Analyze([]byte("Hello to the World"))

		err := index.Write(&resource.IndexableDocument{
			RV:   1,
			Name: "name1",
			Key: &resource.ResourceKey{
				Name:      "aaa",
				Namespace: key.Namespace,
				Group:     key.Group,
				Resource:  key.Resource,
			},
			Title: "I want to say Hello TO THE WORLD and JEFFREY",
		})
		require.NoError(t, err)

		//debugAnalyzer(index.(*bleveIndex).index, TITLE_ANALYZER, "I want to say Hello TO THE WORLD and MORRREE")
		//debugAnalyzer(index.(*bleveIndex).index, standard.Name, "I want to say Hello TO THE WORLD and MORRREE")
		//debugAnalyzer(index.(*bleveIndex).index, simple.Name, "I want to say Hello TO THE WORLD and MORRREE")
		//debugIndexedTerms(index.(*bleveIndex).index, resource.SEARCH_FIELD_TITLE)

		// search for word at start
		query := newQuery("hello")
		res, err := index.Search(context.Background(), nil, query, nil)
		require.NoError(t, err)
		require.Equal(t, res.TotalHits, int64(1))

		// search for word larger than ngram max size
		query = newQuery("jeffrey")
		res, err = index.Search(context.Background(), nil, query, nil)
		require.NoError(t, err)
		require.Equal(t, res.TotalHits, int64(1))

		// search for word at end
		query = newQuery("world")
		res, err = index.Search(context.Background(), nil, query, nil)
		require.NoError(t, err)
		require.Equal(t, res.TotalHits, int64(1))

		// search for word in middle less than 3 chars
		query = newQuery("to")
		res, err = index.Search(context.Background(), nil, query, nil)
		require.NoError(t, err)
		require.Equal(t, res.TotalHits, int64(1))

		// can search for word substring anchored at start of word (edge ngram)
		query = newQuery("worl")
		res, err = index.Search(context.Background(), nil, query, nil)
		require.NoError(t, err)
		require.Equal(t, res.TotalHits, int64(1))
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
