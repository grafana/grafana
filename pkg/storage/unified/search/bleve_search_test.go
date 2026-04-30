package search_test

import (
	"context"
	"fmt"
	"log"
	"strings"
	"testing"
	"time"

	"github.com/blevesearch/bleve/v2"
	authlib "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/store/kind/dashboard"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search"
	"github.com/grafana/grafana/pkg/storage/unified/search/builders"
)

const threshold = 9999

func indexDocumentsWithTitles(t *testing.T, index resource.ResourceIndex, key resource.NamespacedResource, docsWithTitles map[string]string) {
	items := make([]*resource.BulkIndexItem, 0, len(docsWithTitles))
	for name, title := range docsWithTitles {
		items = append(items, &resource.BulkIndexItem{
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
	req := &resource.BulkIndexRequest{Items: items}
	require.NoError(t, index.BulkIndex(req))
}

func checkSearchQuery(t *testing.T, index resource.ResourceIndex, query *resourcepb.ResourceSearchRequest, orderedExpectedNames []string) {
	res, err := index.Search(context.Background(), nil, query, nil, nil)
	require.NoError(t, err)
	require.Equal(t, int64(len(orderedExpectedNames)), res.TotalHits)
	for ix, name := range orderedExpectedNames {
		require.Equal(t, name, res.Results.Rows[ix].Key.Name)
	}
}

func TestCanSearchByTitle(t *testing.T) {
	key := resource.NamespacedResource{
		Namespace: "default",
		Group:     "dashboard.grafana.app",
		Resource:  "dashboards",
	}

	t.Run("when query is empty, sort documents by title instead of search score", func(t *testing.T) {
		index := newTestDashboardsIndex(t, threshold, 2, noop)
		indexDocumentsWithTitles(t, index, key, map[string]string{
			"name1": "bbb",
			"name2": "aaa",
		})

		checkSearchQuery(t, index, newTestQuery(""), []string{"name2", "name1"})
	})

	t.Run("will boost phrase match query over match query results", func(t *testing.T) {
		index := newTestDashboardsIndex(t, threshold, 2, noop)
		indexDocumentsWithTitles(t, index, key, map[string]string{
			"name1": "I want to say a hello",
			"name2": "we want hello",
		})

		checkSearchQuery(t, index, newTestQuery("want hello"), []string{"name2", "name1"})
	})

	t.Run("will prioritize matches", func(t *testing.T) {
		index := newTestDashboardsIndex(t, threshold, 2, noop)
		indexDocumentsWithTitles(t, index, key, map[string]string{
			"name1": "Asserts Dashboards",
			"name2": "New dashboard 10",
		})

		checkSearchQuery(t, index, newTestQuery("dashboard"), []string{"name2", "name1"})
	})

	t.Run("all terms must match", func(t *testing.T) {
		index := newTestDashboardsIndex(t, threshold, 2, noop)
		indexDocumentsWithTitles(t, index, key, map[string]string{
			"name1": "Dashboard",
			"name2": "New dashboard 10",
		})

		checkSearchQuery(t, index, newTestQuery("dashboard new"), []string{"name2"})
	})

	t.Run("will boost exact match query over match phrase query results", func(t *testing.T) {
		index := newTestDashboardsIndex(t, threshold, 2, noop)
		indexDocumentsWithTitles(t, index, key, map[string]string{
			"name1": "we want hello pls",
			"name2": "we want hello",
		})

		checkSearchQuery(t, index, newTestQuery("we want hello"), []string{"name2", "name1"})
	})

	t.Run("title with numbers will match document", func(t *testing.T) {
		index := newTestDashboardsIndex(t, threshold, 2, noop)
		indexDocumentsWithTitles(t, index, key, map[string]string{
			"name1": "A123456",
		})

		// search for prefix of title with mix of chars and numbers
		checkSearchQuery(t, index, newQueryByTitle("A12"), []string{"name1"})
		// search for whole title
		checkSearchQuery(t, index, newQueryByTitle("A123456"), []string{"name1"})
		// case insensive search for partial title
		checkSearchQuery(t, index, newQueryByTitle("a1234"), []string{"name1"})
	})

	t.Run("title will match escaped characters", func(t *testing.T) {
		index := newTestDashboardsIndex(t, threshold, 2, noop)
		indexDocumentsWithTitles(t, index, key, map[string]string{
			"name1": "what\"s up",
			"name2": "what\"s that",
		})

		checkSearchQuery(t, index, newQueryByTitle("what\"s up"), []string{"name1"})
		checkSearchQuery(t, index, newQueryByTitle("what\"s"), []string{"name2", "name1"})
	})

	t.Run("title search will match document", func(t *testing.T) {
		index := newTestDashboardsIndex(t, threshold, 2, noop)
		indexDocumentsWithTitles(t, index, key, map[string]string{
			"name1": "I want to say a wonderfully Hello to the WORLD! Hello-world",
		})

		// search by entire phrase
		checkSearchQuery(t, index, newTestQuery("I want to say a wonderfully Hello to the WORLD! Hello-world"), []string{"name1"})

		// search for word at start
		checkSearchQuery(t, index, newTestQuery("hello"), []string{"name1"})
		// search for word larger than ngram max size
		checkSearchQuery(t, index, newTestQuery("wonderfully"), []string{"name1"})
		// search for word at end
		checkSearchQuery(t, index, newTestQuery("world"), []string{"name1"})
		// can search for word substring at start of word (ngram)
		checkSearchQuery(t, index, newTestQuery("worl"), []string{"name1"})
		// can search for word substring in middle of word (ngram, not edge-only)
		checkSearchQuery(t, index, newTestQuery("ello"), []string{"name1"})
		// can search for multiple, non-consecutive words in title
		checkSearchQuery(t, index, newTestQuery("hello world"), []string{"name1"})
		// can search for multiple, non-consecutive words in title
		checkSearchQuery(t, index, newTestQuery("hello-world"), []string{"name1"})
	})

	t.Run("title search will NOT match documents", func(t *testing.T) {
		index := newTestDashboardsIndex(t, threshold, 2, noop)
		indexDocumentsWithTitles(t, index, key, map[string]string{
			"name1": "I want to say a wonderfully Hello to the WORLD! Hello-world",
			"name2": "A0456",
			"name3": "mash-A02382-10",
		})

		// word that doesn't exist
		checkSearchQuery(t, index, newTestQuery("cats"), nil)
		// string shorter than 3 chars (ngram min)
		checkSearchQuery(t, index, newTestQuery("ma"), nil)
		// substring that doesn't exist
		checkSearchQuery(t, index, newTestQuery("A01"), nil)
	})

	t.Run("title search with character will match one document", func(t *testing.T) {
		index := newTestDashboardsIndex(t, threshold, 2, noop)
		indexDocumentsWithTitles(t, index, key, map[string]string{
			"name1": "foo",
		})

		for i, v := range search.TermCharacters {
			name := fmt.Sprintf("name%d", i)
			title := fmt.Sprintf(`test foo%d%sbar`, i, v)
			indexDocumentsWithTitles(t, index, key, map[string]string{
				name: title,
			})

			checkSearchQuery(t, index, newQueryByTitle(title), []string{name})

			// can search for a title with a term character suffix
			checkSearchQuery(t, index, newQueryByTitle(fmt.Sprintf(`foo%d%s`, i, v)), []string{name})
		}
	})

	t.Run("title search will ignore terms < 3 characters", func(t *testing.T) {
		index := newTestDashboardsIndex(t, threshold, 2, noop)
		indexDocumentsWithTitles(t, index, key, map[string]string{
			"name1": "new dashboard",
			"name2": "new dash",
			"name3": "new",
		})

		// matches everything
		checkSearchQuery(t, index, newTestQuery("new"), []string{"name3", "name2", "name1"})
		// ignore terms shorter than 3 chars
		checkSearchQuery(t, index, newTestQuery("new d"), []string{"name3", "name2", "name1"})
		// include terms shorter that are exactly 3 chars
		checkSearchQuery(t, index, newTestQuery("new das"), []string{"name2", "name1"})
	})

	t.Run("multi-word exact title match gets highest score", func(t *testing.T) {
		index := newTestDashboardsIndex(t, threshold, 2, noop)
		indexDocumentsWithTitles(t, index, key, map[string]string{
			"name1": "Quick Brown Fox",
			"name2": "Quick Brown Fox Jumps",
		})
		// exact title "Quick Brown Fox" should score highest (boost=10 on title_phrase)
		checkSearchQuery(t, index, newTestQuery("Quick Brown Fox"), []string{"name1", "name2"})
	})

	t.Run("lowercase search matches via exact match boost", func(t *testing.T) {
		index := newTestDashboardsIndex(t, threshold, 2, noop)
		indexDocumentsWithTitles(t, index, key, map[string]string{
			"name1": "Quick Brown Fox Jumps Over",
			"name2": "Quick Brown Fox",
		})
		// lowercase query should get exact-match boost via pre-lowered title_phrase
		// name2 is exact match (boost=10) so it ranks first despite name ordering
		checkSearchQuery(t, index, newTestQuery("quick brown fox"), []string{"name2", "name1"})
	})

	t.Run("title search will%smatch term in the middle/end", func(t *testing.T) {
		index := newTestDashboardsIndex(t, threshold, 2, noop)
		indexDocumentsWithTitles(t, index, key, map[string]string{
			"name1": "new dashboard",
			"name2": "new dash",
			"name3": "somedash",
		})

		checkSearchQuery(t, index, newTestQuery("ash"), []string{"name2", "name3", "name1"})
		checkSearchQuery(t, index, newTestQuery("ome"), []string{"name3"})
	})
}

// TestTitleNgramFieldSearch queries exclusively against the title_ngram field
// (via explicit QueryFields) to prove the dedicated ngram index mapping works
// independently of the ngram mapping still present on the title field.
// Once all instances have this mapping, the ngram mapping on title can be
// removed and partial/prefix matching will rely entirely on title_ngram.
func TestTitleNgramFieldSearch(t *testing.T) {
	key := resource.NamespacedResource{
		Namespace: "default",
		Group:     "dashboard.grafana.app",
		Resource:  "dashboards",
	}

	newNgramOnlyQuery := func(q string) *resourcepb.ResourceSearchRequest {
		return &resourcepb.ResourceSearchRequest{
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{
					Namespace: "default",
					Group:     "dashboard.grafana.app",
					Resource:  "dashboards",
				},
			},
			Limit: 100000,
			Query: q,
			QueryFields: []*resourcepb.ResourceSearchRequest_QueryField{
				{
					Name:  resource.SEARCH_FIELD_TITLE_NGRAM,
					Type:  resourcepb.QueryFieldType_TEXT,
					Boost: 1,
				},
			},
		}
	}

	t.Run("title_ngram field matches partial word at start", func(t *testing.T) {
		index := newTestDashboardsIndex(t, threshold, 2, noop)
		indexDocumentsWithTitles(t, index, key, map[string]string{
			"name1": "Hello WORLD",
			"name2": "Something Else",
		})
		checkSearchQuery(t, index, newNgramOnlyQuery("worl"), []string{"name1"})
	})

	t.Run("title_ngram field matches partial word in middle", func(t *testing.T) {
		index := newTestDashboardsIndex(t, threshold, 2, noop)
		indexDocumentsWithTitles(t, index, key, map[string]string{
			"name1": "new dashboard",
			"name2": "somedash",
			"name3": "unrelated",
		})
		// "ash" is a middle-of-word ngram in "dashboard" and "somedash"
		// "somedash" (shorter, higher TF-IDF) ranks above "new dashboard" (longer)
		checkSearchQuery(t, index, newNgramOnlyQuery("ash"), []string{"name2", "name1"})
	})

	t.Run("title_ngram field matches full word", func(t *testing.T) {
		index := newTestDashboardsIndex(t, threshold, 2, noop)
		indexDocumentsWithTitles(t, index, key, map[string]string{
			"name1": "Hello World",
			"name2": "Goodbye Moon",
		})
		checkSearchQuery(t, index, newNgramOnlyQuery("hello"), []string{"name1"})
	})

	t.Run("title_ngram field does not match short terms below ngram min", func(t *testing.T) {
		index := newTestDashboardsIndex(t, threshold, 2, noop)
		indexDocumentsWithTitles(t, index, key, map[string]string{
			"name1": "dashboard",
		})
		// "da" is 2 chars, below NGRAM_MIN_TOKEN (3) — removeSmallTerms strips it
		checkSearchQuery(t, index, newNgramOnlyQuery("da"), nil)
	})
}

func TestWildcardQuery(t *testing.T) {
	key := resource.NamespacedResource{
		Namespace: "default",
		Group:     "dashboard.grafana.app",
		Resource:  "dashboards",
	}

	t.Run("wildcard query matches title", func(t *testing.T) {
		index := newTestDashboardsIndex(t, threshold, 2, noop)
		indexDocumentsWithTitles(t, index, key, map[string]string{
			"name1": "Hello World",
			"name2": "Goodbye Moon",
		})

		checkSearchQuery(t, index, newTestQuery("hell*"), []string{"name1"})
		// title field also has a keyword mapping that preserves original case,
		// so capitalized wildcards also match
		checkSearchQuery(t, index, newTestQuery("Hell*"), []string{"name1"})
	})

	t.Run("wildcard query with QueryFields searches specified fields", func(t *testing.T) {
		index := newTestDashboardsIndex(t, threshold, 2, noop)
		indexDocumentsWithTitles(t, index, key, map[string]string{
			"name1": "Hello World",
			"name2": "Goodbye Moon",
		})

		req := newTestQuery("hell*")
		req.QueryFields = []*resourcepb.ResourceSearchRequest_QueryField{
			{Name: resource.SEARCH_FIELD_TITLE},
		}
		res, err := index.Search(context.Background(), nil, req, nil, nil)
		require.NoError(t, err)
		require.Equal(t, int64(1), res.TotalHits)

		// QueryFields pointing at a non-matching field should return no results
		req2 := newTestQuery("hell*")
		req2.QueryFields = []*resourcepb.ResourceSearchRequest_QueryField{
			{Name: resource.SEARCH_FIELD_FOLDER},
		}
		res2, err := index.Search(context.Background(), nil, req2, nil, nil)
		require.NoError(t, err)
		require.Equal(t, int64(0), res2.TotalHits)
	})

	t.Run("wildcard query matches multiple documents", func(t *testing.T) {
		index := newTestDashboardsIndex(t, threshold, 2, noop)
		indexDocumentsWithTitles(t, index, key, map[string]string{
			"name1": "Dashboard One",
			"name2": "Dashboard Two",
			"name3": "Alert Rules",
		})

		res, err := index.Search(context.Background(), nil, newTestQuery("dashboard*"), nil, nil)
		require.NoError(t, err)
		require.Equal(t, int64(2), res.TotalHits)
	})

	t.Run("multi-word wildcard matches via title_phrase", func(t *testing.T) {
		index := newTestDashboardsIndex(t, threshold, 2, noop)
		indexDocumentsWithTitles(t, index, key, map[string]string{
			"name1": "Grafana Dev Overview",
			"name2": "Production Alerts",
		})

		// Legacy dashboard search wraps queries as "*<lowered title>*".
		// Multi-word wildcards can't match word tokens in the standard-analyzed
		// title field, but DO match the keyword-analyzed title_phrase field.
		checkSearchQuery(t, index, newTestQuery("*grafana dev overview*"), []string{"name1"})
		// Partial multi-word match
		checkSearchQuery(t, index, newTestQuery("*dev overview*"), []string{"name1"})
	})

	t.Run("default wildcard searches email and login fields", func(t *testing.T) {
		// Use an index with keyword-analyzed email/login fields (matching
		// production IAM config) so wildcards match full email addresses.
		index := newTestIndexWithFields(t, key, []*resourcepb.ResourceTableColumnDefinition{
			{Name: "email", Type: resourcepb.ResourceTableColumnDefinition_STRING, Properties: &resourcepb.ResourceTableColumnDefinition_Properties{Filterable: true}},
			{Name: "login", Type: resourcepb.ResourceTableColumnDefinition_STRING, Properties: &resourcepb.ResourceTableColumnDefinition_Properties{Filterable: true}},
		})
		require.NoError(t, index.BulkIndex(&resource.BulkIndexRequest{
			Items: []*resource.BulkIndexItem{
				{Action: resource.ActionIndex, Doc: &resource.IndexableDocument{
					RV: 1, Name: "user1", Title: "First User",
					Key:    &resourcepb.ResourceKey{Name: "user1", Namespace: key.Namespace, Group: key.Group, Resource: key.Resource},
					Fields: map[string]any{"email": "uniquemail@grafana.com", "login": "firstlogin"},
				}},
				{Action: resource.ActionIndex, Doc: &resource.IndexableDocument{
					RV: 1, Name: "user2", Title: "Second User",
					Key:    &resourcepb.ResourceKey{Name: "user2", Namespace: key.Namespace, Group: key.Group, Resource: key.Resource},
					Fields: map[string]any{"email": "othermail@grafana.com", "login": "secondlogin"},
				}},
			},
		}))

		// Default wildcard (no QueryFields) should match email field
		checkSearchQuery(t, index, newTestQuery("*uniquemail@grafana.com*"), []string{"user1"})
		// Default wildcard should match login field
		checkSearchQuery(t, index, newTestQuery("*secondlogin*"), []string{"user2"})
		// Wildcard matching domain across both users (order is non-deterministic)
		res, err := index.Search(context.Background(), nil, newTestQuery("*grafana.com*"), nil, nil)
		require.NoError(t, err)
		require.Equal(t, int64(2), res.TotalHits)
	})

	t.Run("QueryFields with title also searches title_phrase", func(t *testing.T) {
		index := newTestDashboardsIndex(t, threshold, 2, noop)
		indexDocumentsWithTitles(t, index, key, map[string]string{
			"name1": "Grafana Dev Overview",
			"name2": "Production Alerts",
		})

		// When QueryFields includes title, multi-word wildcards should still
		// work because title is auto-expanded to title + title_phrase.
		req := newTestQuery("*grafana dev overview*")
		req.QueryFields = []*resourcepb.ResourceSearchRequest_QueryField{
			{Name: resource.SEARCH_FIELD_TITLE},
		}
		res, err := index.Search(context.Background(), nil, req, nil, nil)
		require.NoError(t, err)
		require.Equal(t, int64(1), res.TotalHits)
	})
}

func TestScoringHierarchy(t *testing.T) {
	key := resource.NamespacedResource{
		Namespace: "default",
		Group:     "dashboard.grafana.app",
		Resource:  "dashboards",
	}

	t.Run("exact title match scores above word match and ngram match", func(t *testing.T) {
		index := newTestDashboardsIndex(t, threshold, 2, noop)
		indexDocumentsWithTitles(t, index, key, map[string]string{
			"exact":   "monitor",              // exact match on title_phrase (boost=10) + word match on title (boost=2)
			"partial": "monitoring dashboard", // word match on "monitor" via ngram (boost=1+2)
		})
		// "monitor" should rank the exact title match first
		checkSearchQuery(t, index, newTestQuery("monitor"), []string{"exact", "partial"})
	})

	t.Run("word match scores above ngram-only match", func(t *testing.T) {
		index := newTestDashboardsIndex(t, threshold, 2, noop)
		indexDocumentsWithTitles(t, index, key, map[string]string{
			"word":  "alerts overview",    // "alerts" is a full word — matches via standard analyzer (boost=2) and ngram (boost=1)
			"ngram": "alertstate monitor", // "alert" is a substring of "alertstate" — matches only via ngram (boost=1)
		})
		// "alert" matches "alerts overview" via word+ngram, and "alertstate monitor" via ngram only
		checkSearchQuery(t, index, newTestQuery("alert"), []string{"word", "ngram"})
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

func newExactQueryByTitle(query string) *resourcepb.ResourceSearchRequest {
	return &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Namespace: "default",
				Group:     "dashboard.grafana.app",
				Resource:  "dashboards",
			},
			Fields: []*resourcepb.Requirement{{Key: "title", Operator: "==", Values: []string{query}}},
		},
		Limit: 100000,
	}
}

func TestDoubleEqualsExactMatch(t *testing.T) {
	key := resource.NamespacedResource{
		Namespace: "default",
		Group:     "dashboard.grafana.app",
		Resource:  "dashboards",
	}

	t.Run("double equals on title matches only exact title", func(t *testing.T) {
		index := newTestDashboardsIndex(t, threshold, 2, noop)
		indexDocumentsWithTitles(t, index, key, map[string]string{
			"name1": "Test",
			"name2": "Test Team 1",
			"name3": "Testing Fox Tales",
		})
		// == should only match the document with title exactly "Test"
		checkSearchQuery(t, index, newExactQueryByTitle("Test"), []string{"name1"})
	})

	t.Run("double equals on title is case insensitive", func(t *testing.T) {
		index := newTestDashboardsIndex(t, threshold, 2, noop)
		indexDocumentsWithTitles(t, index, key, map[string]string{
			"name1": "Quick Brown Fox",
			"name2": "Another Fox Story",
		})
		// == with different casing should still match
		checkSearchQuery(t, index, newExactQueryByTitle("quick brown fox"), []string{"name1"})
		checkSearchQuery(t, index, newExactQueryByTitle("QUICK BROWN FOX"), []string{"name1"})
	})

	t.Run("double equals with no values returns error", func(t *testing.T) {
		index := newTestDashboardsIndex(t, threshold, 2, noop)
		indexDocumentsWithTitles(t, index, key, map[string]string{
			"name1": "Test",
		})
		req := &resourcepb.ResourceSearchRequest{
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{
					Namespace: "default",
					Group:     "dashboard.grafana.app",
					Resource:  "dashboards",
				},
				Fields: []*resourcepb.Requirement{{Key: "title", Operator: "==", Values: []string{}}},
			},
			Limit: 100000,
		}
		res, err := index.Search(context.Background(), nil, req, nil, nil)
		require.NoError(t, err)
		require.NotNil(t, res.Error)
		require.Equal(t, int32(400), res.Error.Code)
		require.Contains(t, res.Error.Message, "unsupported query operation")
	})

	t.Run("double equals with multiple values returns error", func(t *testing.T) {
		index := newTestDashboardsIndex(t, threshold, 2, noop)
		indexDocumentsWithTitles(t, index, key, map[string]string{
			"name1": "Test",
			"name2": "Other",
		})
		req := &resourcepb.ResourceSearchRequest{
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{
					Namespace: "default",
					Group:     "dashboard.grafana.app",
					Resource:  "dashboards",
				},
				Fields: []*resourcepb.Requirement{{Key: "title", Operator: "==", Values: []string{"Test", "Other"}}},
			},
			Limit: 100000,
		}
		res, err := index.Search(context.Background(), nil, req, nil, nil)
		require.NoError(t, err)
		require.NotNil(t, res.Error)
		require.Equal(t, int32(400), res.Error.Code)
		require.Contains(t, res.Error.Message, "unsupported query operation")
	})

	t.Run("single equals on title keeps fuzzy behavior", func(t *testing.T) {
		index := newTestDashboardsIndex(t, threshold, 2, noop)
		indexDocumentsWithTitles(t, index, key, map[string]string{
			"name1": "Test",
			"name2": "Test Team 1",
		})
		// = should still match documents containing "Test" (fuzzy/word match)
		checkSearchQuery(t, index, newQueryByTitle("Test"), []string{"name1", "name2"})
	})
}

func newTestDashboardsIndex(t testing.TB, threshold int64, size int64, writer resource.BuildFn) resource.ResourceIndex {
	key := &resourcepb.ResourceKey{
		Namespace: "default",
		Group:     "dashboard.grafana.app",
		Resource:  "dashboards",
	}
	backend, err := search.NewBleveBackend(search.BleveOptions{
		Root:          t.TempDir(),
		FileThreshold: threshold, // use in-memory for tests
	}, nil)
	require.NoError(t, err)

	t.Cleanup(backend.Stop)

	ctx := identity.WithRequester(context.Background(), &user.SignedInUser{Namespace: "ns"})

	info, err := builders.DashboardBuilder(func(ctx context.Context, namespace string, blob resource.BlobSupport) (resource.DocumentBuilder, error) {
		return &builders.DashboardDocumentBuilder{
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
	}, size, info.Fields, "test", writer, nil, false, time.Time{})
	require.NoError(t, err)

	return index
}

// newTestIndexWithFields creates a test index with custom searchable fields
// (e.g. keyword-analyzed email/login for IAM-like tests).
func newTestIndexWithFields(t testing.TB, key resource.NamespacedResource, columns []*resourcepb.ResourceTableColumnDefinition) resource.ResourceIndex {
	backend, err := search.NewBleveBackend(search.BleveOptions{
		Root:          t.TempDir(),
		FileThreshold: threshold,
	}, nil)
	require.NoError(t, err)
	t.Cleanup(backend.Stop)

	ctx := identity.WithRequester(context.Background(), &user.SignedInUser{Namespace: "ns"})
	fields, err := resource.NewSearchableDocumentFields(columns)
	require.NoError(t, err)

	index, err := backend.BuildIndex(ctx, key, 2, fields, "test", noop, nil, false, time.Time{})
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

func TestIndexAndSearchSelectableFields(t *testing.T) {
	key := &resourcepb.ResourceKey{
		Namespace: "default",
		Group:     "test.grafana.app",
		Resource:  "Item",
	}
	backend, err := search.NewBleveBackend(search.BleveOptions{
		Root:          t.TempDir(),
		FileThreshold: threshold, // use in-memory for tests
		SelectableFieldsForKinds: map[string][]string{
			strings.ToLower(key.Group + "/" + key.Resource): {"spec.some.field", "spec.some.other.field"},
		},
	}, nil)
	require.NoError(t, err)
	t.Cleanup(backend.Stop)

	ctx := identity.WithRequester(context.Background(), &user.SignedInUser{Namespace: "ns"})

	index, err := backend.BuildIndex(ctx, resource.NamespacedResource{
		Namespace: key.Namespace,
		Group:     key.Group,
		Resource:  key.Resource,
	}, 10, nil, "test", noop, nil, false, time.Time{})
	require.NoError(t, err)

	err = index.BulkIndex(&resource.BulkIndexRequest{
		Items: []*resource.BulkIndexItem{
			{
				Action: resource.ActionIndex,
				Doc: &resource.IndexableDocument{
					Key:   &resourcepb.ResourceKey{Namespace: key.Namespace, Group: key.Group, Resource: key.Resource, Name: "doc1"},
					Title: "Document 1",
					Fields: map[string]interface{}{
						"field1": 1,
						"field2": "value1",
					},
					SelectableFields: map[string]string{
						"spec.some.field":       "doc1_field_value",
						"spec.some.other.field": "other_field_value",
						"unknown.field":         "another_value",
					},
				},
			},
			{
				Action: resource.ActionIndex,
				Doc: &resource.IndexableDocument{
					Key:   &resourcepb.ResourceKey{Namespace: key.Namespace, Group: key.Group, Resource: key.Resource, Name: "doc2"},
					Title: "Document 2",
					Tags:  []string{"tag2", "tag3"},
					Fields: map[string]interface{}{
						"field1": 2,
						"field2": "value2",
					},
					SelectableFields: map[string]string{
						"spec.some.field":       "doc2_field_value",
						"spec.some.other.field": "other_field_value",
						"unknown.field":         "another_value",
					},
				},
			},
			{
				Action: resource.ActionIndex,
				Doc: &resource.IndexableDocument{
					Key:   &resourcepb.ResourceKey{Namespace: key.Namespace, Group: key.Group, Resource: key.Resource, Name: "doc3"},
					Title: "Document with field values with token terminating characters",
					SelectableFields: map[string]string{
						"spec.some.field":       "doc3-field#value!",
						"spec.some.other.field": "some other.field>value",
					},
				},
			},
		},
	})
	require.NoError(t, err)

	checkSearchQuery(t, index, selectableFieldQuery(key, resource.SEARCH_SELECTABLE_FIELDS_PREFIX+"spec.some.field", "doc1_field_value"), []string{"doc1"})
	checkSearchQuery(t, index, selectableFieldQuery(key, resource.SEARCH_SELECTABLE_FIELDS_PREFIX+"spec.some.field", "doc2_field_value"), []string{"doc2"})
	checkSearchQuery(t, index, selectableFieldQuery(key, resource.SEARCH_SELECTABLE_FIELDS_PREFIX+"spec.some.other.field", "other_field_value"), []string{"doc1", "doc2"})

	// tests for doc3 with token-terminating characters
	checkSearchQuery(t, index, selectableFieldQuery(key, resource.SEARCH_SELECTABLE_FIELDS_PREFIX+"spec.some.field", "doc3-field#value!"), []string{"doc3"})
	checkSearchQuery(t, index, selectableFieldQuery(key, resource.SEARCH_SELECTABLE_FIELDS_PREFIX+"spec.some.other.field", "some other.field>value"), []string{"doc3"})

	// Only known selectable fields are indexed.
	checkSearchQuery(t, index, selectableFieldQuery(key, resource.SEARCH_SELECTABLE_FIELDS_PREFIX+"unknown.field", "another_value"), nil)
}

func selectableFieldQuery(key *resourcepb.ResourceKey, field, value string) *resourcepb.ResourceSearchRequest {
	return &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{
			Key:    key,
			Fields: []*resourcepb.Requirement{{Key: field, Operator: "=", Values: []string{value}}},
		},
		Limit: 100000,
	}
}

// testAccessClient is a simple access client for testing that allows access
// only to resources in the specified folders. An empty allowedFolders set
// means access is denied to everything.
type testAccessClient struct {
	allowedFolders map[string]bool
}

func (c *testAccessClient) Check(_ context.Context, _ authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
	return authlib.CheckResponse{Allowed: c.allowedFolders[folder], Zookie: authlib.NoopZookie{}}, nil
}

func (c *testAccessClient) Compile(_ context.Context, _ authlib.AuthInfo, _ authlib.ListRequest) (authlib.ItemChecker, authlib.Zookie, error) {
	return func(name, folder string) bool { return c.allowedFolders[folder] }, authlib.NoopZookie{}, nil
}

func (c *testAccessClient) BatchCheck(_ context.Context, _ authlib.AuthInfo, req authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
	results := make(map[string]authlib.BatchCheckResult, len(req.Checks))
	for _, item := range req.Checks {
		results[item.CorrelationID] = authlib.BatchCheckResult{Allowed: c.allowedFolders[item.Folder]}
	}
	return authlib.BatchCheckResponse{Results: results}, nil
}

func checkSearchQueryWithAccess(t *testing.T, index resource.ResourceIndex, ac authlib.AccessClient, query *resourcepb.ResourceSearchRequest, expectedNames []string) {
	t.Helper()
	user := &identity.StaticRequester{
		Type:      authlib.TypeUser,
		UserID:    1,
		Namespace: query.Options.Key.Namespace,
	}
	ctx := authlib.WithAuthInfo(context.Background(), user)
	res, err := index.Search(ctx, ac, query, nil, nil)
	require.NoError(t, err)
	names := make([]string, 0, len(res.Results.GetRows()))
	for _, row := range res.Results.GetRows() {
		names = append(names, row.Key.Name)
	}
	require.ElementsMatch(t, expectedNames, names)
}

func TestSearchPermissionFiltering(t *testing.T) {
	key := resource.NamespacedResource{
		Namespace: "default",
		Group:     "dashboard.grafana.app",
		Resource:  "dashboards",
	}

	indexDocumentsWithFolders := func(t *testing.T, index resource.ResourceIndex, docs map[string]string) {
		t.Helper()
		items := make([]*resource.BulkIndexItem, 0, len(docs))
		for name, folder := range docs {
			items = append(items, &resource.BulkIndexItem{
				Action: resource.ActionIndex,
				Doc: &resource.IndexableDocument{
					RV:    1,
					Name:  name,
					Title: name,
					Key: &resourcepb.ResourceKey{
						Name:      name,
						Namespace: key.Namespace,
						Group:     key.Group,
						Resource:  key.Resource,
					},
					Folder: folder,
				},
			})
		}
		require.NoError(t, index.BulkIndex(&resource.BulkIndexRequest{Items: items}))
	}

	query := &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Namespace: key.Namespace,
				Group:     key.Group,
				Resource:  key.Resource,
			},
		},
		Limit: 100000,
	}

	t.Run("returns all documents when access client is nil", func(t *testing.T) {
		index := newTestDashboardsIndex(t, threshold, 2, noop)
		indexDocumentsWithFolders(t, index, map[string]string{
			"doc-a": "folder-a",
			"doc-b": "folder-b",
		})
		checkSearchQueryWithAccess(t, index, nil, query, []string{"doc-a", "doc-b"})
	})

	t.Run("returns only documents in allowed folders", func(t *testing.T) {
		index := newTestDashboardsIndex(t, threshold, 2, noop)
		indexDocumentsWithFolders(t, index, map[string]string{
			"doc-a": "folder-a",
			"doc-b": "folder-b",
			"doc-c": "folder-a",
		})
		ac := &testAccessClient{allowedFolders: map[string]bool{"folder-a": true}}
		checkSearchQueryWithAccess(t, index, ac, query, []string{"doc-a", "doc-c"})
	})

	t.Run("returns no documents when user has no folder access", func(t *testing.T) {
		index := newTestDashboardsIndex(t, threshold, 2, noop)
		indexDocumentsWithFolders(t, index, map[string]string{
			"doc-a": "folder-a",
			"doc-b": "folder-b",
		})
		ac := &testAccessClient{allowedFolders: map[string]bool{}}
		checkSearchQueryWithAccess(t, index, ac, query, []string{})
	})

	t.Run("returns documents from multiple allowed folders", func(t *testing.T) {
		index := newTestDashboardsIndex(t, threshold, 2, noop)
		indexDocumentsWithFolders(t, index, map[string]string{
			"doc-a": "folder-a",
			"doc-b": "folder-b",
			"doc-c": "folder-c",
		})
		ac := &testAccessClient{allowedFolders: map[string]bool{"folder-a": true, "folder-b": true}}
		checkSearchQueryWithAccess(t, index, ac, query, []string{"doc-a", "doc-b"})
	})
}
