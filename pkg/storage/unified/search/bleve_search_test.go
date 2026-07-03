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
	apischema "k8s.io/apimachinery/pkg/runtime/schema"

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

// Partial queries against a hyphenated title must match it even when the
// trailing fragment (e.g. "ma" in "users-service-ma") is shorter than the
// ngram minimum.
func TestHyphenatedTitlePartialMatch(t *testing.T) {
	key := resource.NamespacedResource{
		Namespace: "default",
		Group:     "dashboard.grafana.app",
		Resource:  "dashboards",
	}
	index := newTestDashboardsIndex(t, threshold, 2, noop)
	indexDocumentsWithTitles(t, index, key, map[string]string{
		"name1": "users-service-managed",
		"name2": "billing-service-v2",
	})

	for _, query := range []string{"users-service", "users-service-ma", "users-service-man", "users-service-managed"} {
		checkSearchQuery(t, index, newTestQuery(query), []string{"name1"})
	}

	// Precision is preserved: a discriminating suffix shorter than the ngram
	// minimum must not cross-match a different title.
	checkSearchQuery(t, index, newTestQuery("billing-service-v2"), []string{"name2"})
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
		// substring that doesn't exist
		checkSearchQuery(t, index, newTestQuery("A01"), nil)
	})

	t.Run("queries shorter than ngram min are rewritten as prefix wildcards", func(t *testing.T) {
		index := newTestDashboardsIndex(t, threshold, 2, noop)
		indexDocumentsWithTitles(t, index, key, map[string]string{
			"name1": "First Team",
			"name2": "Team Alpha",
			"name3": "Team Beta",
			"name4": "mash potato",
		})

		// 1- and 2-char queries can't hit the n-gram index, so we rewrite them as
		// a prefix wildcard ("f" → "f*"). The wildcard matches any token starting
		// with the prefix, giving search-as-you-type prefix matching for short input.
		checkSearchQuery(t, index, newTestQuery("f"), []string{"name1"})
		checkSearchQuery(t, index, newTestQuery("fi"), []string{"name1"})
		checkSearchQuery(t, index, newTestQuery("ma"), []string{"name4"})
		// no word in any title starts with "zz" — prefix wildcard matches nothing.
		checkSearchQuery(t, index, newTestQuery("zz"), nil)
	})

	t.Run("title filter ignores empty tokens from split values", func(t *testing.T) {
		index := newTestDashboardsIndex(t, threshold, 2, noop)
		indexDocumentsWithTitles(t, index, key, map[string]string{
			"name1": "foo bar",
			"name2": "baz",
		})

		checkSearchQuery(t, index, newQueryByTitle("foo "), []string{"name1"})
		checkSearchQuery(t, index, newQueryByTitle("foo-"), []string{"name1"})
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
// (via explicit QueryFields) to prove partial/prefix matching works without
// relying on the title field mapping.
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

	t.Run("queries shorter than ngram min match via prefix wildcard", func(t *testing.T) {
		index := newTestDashboardsIndex(t, threshold, 2, noop)
		indexDocumentsWithTitles(t, index, key, map[string]string{
			"name1": "dashboard",
			"name2": "unrelated",
		})
		// "da" is 2 chars, below NGRAM_MIN_TOKEN (3). The query is rewritten to
		// "da*" and matched as a wildcard against the title_ngram tokens — only
		// the n-gram tokens starting with "da" match (e.g. "das", "dash", "dashb").
		checkSearchQuery(t, index, newNgramOnlyQuery("da"), []string{"name1"})
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
		// Title wildcard search is case-insensitive because title fields are indexed lowercased.
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
		// Wildcard matching is case-insensitive for title_phrase.
		checkSearchQuery(t, index, newTestQuery("*Dev Overview*"), []string{"name1"})
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
	info, err := builders.DashboardBuilder(func(ctx context.Context, namespace string, blob resource.BlobSupport) (resource.DocumentBuilder, error) {
		return &builders.DashboardDocumentBuilder{
			Namespace:        namespace,
			Blob:             blob,
			Stats:            make(map[string]map[string]int64), // empty stats
			DatasourceLookup: dashboard.CreateDatasourceLookup([]*dashboard.DatasourceQueryResult{{}}),
		}, nil
	})
	require.NoError(t, err)

	backend, err := search.NewBleveBackend(search.BleveOptions{
		Root:          t.TempDir(),
		FileThreshold: threshold, // use in-memory for tests
		SearchFieldsProvidersForKinds: map[string]resource.SearchFieldsProvider{
			"dashboard.grafana.app/dashboards": info.SearchFieldsProvider,
		},
	}, nil)
	require.NoError(t, err)

	t.Cleanup(backend.Stop)

	ctx := identity.WithRequester(context.Background(), &user.SignedInUser{Namespace: "ns"})

	index, err := backend.BuildIndex(ctx, resource.NamespacedResource{
		Namespace: key.Namespace,
		Group:     key.Group,
		Resource:  key.Resource,
	}, size, "test", writer, nil, false, time.Time{}, 0)
	require.NoError(t, err)

	return index
}

// newTestIndexWithFields creates a test index with custom searchable fields
// (e.g. keyword-analyzed email/login for IAM-like tests). Each column
// becomes a SearchFieldDefinition declaring [filter, retrieve] when the
// column carries Properties.Filterable, otherwise [retrieve] only; the
// provider drives the per-kind bleve mapping.
func newTestIndexWithFields(t testing.TB, key resource.NamespacedResource, columns []*resourcepb.ResourceTableColumnDefinition) resource.ResourceIndex {
	gvr := apischema.GroupVersionResource{Group: key.Group, Version: "v0", Resource: key.Resource}
	sfds := make([]resource.SearchFieldDefinition, 0, len(columns))
	for _, c := range columns {
		caps := []resource.SearchCapability{resource.SearchCapabilityRetrieve}
		if c.Properties != nil && c.Properties.Filterable && c.Type == resourcepb.ResourceTableColumnDefinition_STRING {
			caps = []resource.SearchCapability{resource.SearchCapabilityFilter, resource.SearchCapabilityRetrieve}
		}
		sfds = append(sfds, resource.SearchFieldDefinition{Name: c.Name, Type: resource.SearchFieldTypeString, Array: c.IsArray, Capabilities: caps})
	}
	provider := resource.NewMapProvider(
		map[apischema.GroupVersionResource][]resource.SearchFieldDefinition{gvr: sfds},
		map[apischema.GroupResource]string{gvr.GroupResource(): gvr.Version},
	)
	sfKey := strings.ToLower(key.Group + "/" + key.Resource)

	backend, err := search.NewBleveBackend(search.BleveOptions{
		Root:                          t.TempDir(),
		FileThreshold:                 threshold,
		SearchFieldsProvidersForKinds: map[string]resource.SearchFieldsProvider{sfKey: provider},
	}, nil)
	require.NoError(t, err)
	t.Cleanup(backend.Stop)

	ctx := identity.WithRequester(context.Background(), &user.SignedInUser{Namespace: "ns"})

	index, err := backend.BuildIndex(ctx, key, 2, "test", noop, nil, false, time.Time{}, 0)
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
	}, 10, "test", noop, nil, false, time.Time{}, 0)
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

// newTestDashboardsIndexPostRank builds a dashboards index with the
// post-rank-authz path enabled and default tunables.
func newTestDashboardsIndexPostRank(t testing.TB, size int64) resource.ResourceIndex {
	return newTestDashboardsIndexPostRankWithConfig(t, size, search.PostRankAuthzConfig{})
}

// newTestDashboardsIndexPostRankWithConfig builds a dashboards index with the
// post-rank-authz path enabled and the given tunables (zero values fall back to
// the bleve defaults).
func newTestDashboardsIndexPostRankWithConfig(t testing.TB, size int64, cfg search.PostRankAuthzConfig) resource.ResourceIndex {
	t.Helper()
	key := &resourcepb.ResourceKey{
		Namespace: "default",
		Group:     "dashboard.grafana.app",
		Resource:  "dashboards",
	}
	info, err := builders.DashboardBuilder(func(ctx context.Context, namespace string, blob resource.BlobSupport) (resource.DocumentBuilder, error) {
		return &builders.DashboardDocumentBuilder{
			Namespace:        namespace,
			Blob:             blob,
			Stats:            make(map[string]map[string]int64),
			DatasourceLookup: dashboard.CreateDatasourceLookup([]*dashboard.DatasourceQueryResult{{}}),
		}, nil
	})
	require.NoError(t, err)

	backend, err := search.NewBleveBackend(search.BleveOptions{
		Root:                 t.TempDir(),
		FileThreshold:        threshold, // use in-memory for tests
		PostRankAuthzEnabled: true,
		PostRankAuthz:        cfg,
		SearchFieldsProvidersForKinds: map[string]resource.SearchFieldsProvider{
			"dashboard.grafana.app/dashboards": info.SearchFieldsProvider,
		},
	}, nil)
	require.NoError(t, err)
	t.Cleanup(backend.Stop)

	ctx := identity.WithRequester(context.Background(), &user.SignedInUser{Namespace: "ns"})
	index, err := backend.BuildIndex(ctx, resource.NamespacedResource{
		Namespace: key.Namespace,
		Group:     key.Group,
		Resource:  key.Resource,
	}, size, "test", noop, nil, false, time.Time{}, 0)
	require.NoError(t, err)
	return index
}

// countingAccessClient allows access based on allowedFolders (an empty/nil map
// allows everything) and records how many items it was asked to check, so tests
// can assert that authorization stops early once the page is full.
type countingAccessClient struct {
	allowAll       bool
	allowedFolders map[string]bool
	checked        int
	// batchChecks counts BatchCheck invocations. It equals the number of
	// post-rank bleve windows only when each window fits in one FilterAuthorized
	// batch (batch size 500); with larger windows one window can produce
	// multiple BatchCheck calls. The growth test uses small windows (MaxWindow
	// 40) so batchChecks == window count there.
	batchChecks int
}

func (c *countingAccessClient) allow(folder string) bool {
	if c.allowAll {
		return true
	}
	return c.allowedFolders[folder]
}

func (c *countingAccessClient) Check(_ context.Context, _ authlib.AuthInfo, _ authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
	return authlib.CheckResponse{Allowed: c.allow(folder), Zookie: authlib.NoopZookie{}}, nil
}

func (c *countingAccessClient) Compile(_ context.Context, _ authlib.AuthInfo, _ authlib.ListRequest) (authlib.ItemChecker, authlib.Zookie, error) {
	return func(_, folder string) bool { return c.allow(folder) }, authlib.NoopZookie{}, nil
}

func (c *countingAccessClient) BatchCheck(_ context.Context, _ authlib.AuthInfo, req authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
	c.batchChecks++
	c.checked += len(req.Checks)
	results := make(map[string]authlib.BatchCheckResult, len(req.Checks))
	for _, item := range req.Checks {
		results[item.CorrelationID] = authlib.BatchCheckResult{Allowed: c.allow(item.Folder)}
	}
	return authlib.BatchCheckResponse{Results: results}, nil
}

// postRankKey is the resource key shared by the post-rank authz tests.
var postRankKey = resource.NamespacedResource{
	Namespace: "default",
	Group:     "dashboard.grafana.app",
	Resource:  "dashboards",
}

// Post-rank authz test helpers. They are package-level (not closures inside
// TestSearchPostRankAuthz) so their bodies don't roll up into that test's
// cyclomatic complexity.

func indexDocs(t *testing.T, index resource.ResourceIndex, docs []*resource.BulkIndexItem) {
	t.Helper()
	require.NoError(t, index.BulkIndex(&resource.BulkIndexRequest{Items: docs}))
}

func newDoc(name, folder string) *resource.BulkIndexItem {
	return &resource.BulkIndexItem{
		Action: resource.ActionIndex,
		Doc: &resource.IndexableDocument{
			RV:    1,
			Name:  name,
			Title: name,
			Key: &resourcepb.ResourceKey{
				Name:      name,
				Namespace: postRankKey.Namespace,
				Group:     postRankKey.Group,
				Resource:  postRankKey.Resource,
			},
			Folder: folder,
		},
	}
}

func listQuery(limit int64) *resourcepb.ResourceSearchRequest {
	return &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Namespace: postRankKey.Namespace,
				Group:     postRankKey.Group,
				Resource:  postRankKey.Resource,
			},
		},
		Limit: limit,
	}
}

func searchNames(t *testing.T, index resource.ResourceIndex, ac authlib.AccessClient, q *resourcepb.ResourceSearchRequest) ([]string, *resourcepb.ResourceSearchResponse) {
	t.Helper()
	requester := &identity.StaticRequester{Type: authlib.TypeUser, UserID: 1, Namespace: postRankKey.Namespace}
	ctx := authlib.WithAuthInfo(context.Background(), requester)
	res, err := index.Search(ctx, ac, q, nil, nil)
	require.NoError(t, err)
	require.Nil(t, res.Error)
	names := make([]string, 0, len(res.Results.GetRows()))
	for _, row := range res.Results.GetRows() {
		names = append(names, row.Key.Name)
	}
	return names, res
}

// columnNames returns the response table's column names, used to assert that
// fields loaded only for authorization (e.g. folder) don't leak into results.
func columnNames(res *resourcepb.ResourceSearchResponse) []string {
	cols := res.Results.GetColumns()
	names := make([]string, 0, len(cols))
	for _, c := range cols {
		names = append(names, c.Name)
	}
	return names
}

// searchResponse runs a search and returns the raw response (without asserting
// on res.Error), so tests can assert on error/bad-request behavior.
func searchResponse(t *testing.T, index resource.ResourceIndex, ac authlib.AccessClient, q *resourcepb.ResourceSearchRequest) *resourcepb.ResourceSearchResponse {
	t.Helper()
	requester := &identity.StaticRequester{Type: authlib.TypeUser, UserID: 1, Namespace: postRankKey.Namespace}
	ctx := authlib.WithAuthInfo(context.Background(), requester)
	res, err := index.Search(ctx, ac, q, nil, nil)
	require.NoError(t, err)
	return res
}

// pageAll walks SearchAfter cursors until a short/empty page, returning the
// names in the order they were returned across pages.
func pageAll(t *testing.T, index resource.ResourceIndex, ac authlib.AccessClient, limit int64) []string {
	t.Helper()
	var all []string
	var after []string
	for page := 0; ; page++ {
		require.Less(t, page, 1000, "pagination did not terminate")
		q := listQuery(limit)
		q.SearchAfter = after
		names, res := searchNames(t, index, ac, q)
		require.LessOrEqual(t, len(names), int(limit))
		all = append(all, names...)
		rows := res.Results.GetRows()
		if len(rows) == 0 {
			break
		}
		after = rows[len(rows)-1].SortFields
		require.NotEmpty(t, after, "every returned row must carry sort values for the next cursor")
		if len(rows) < int(limit) {
			break
		}
	}
	return all
}

func TestSearchPostRankAuthz(t *testing.T) {
	t.Run("stops checking once the page is full", func(t *testing.T) {
		index := newTestDashboardsIndexPostRank(t, 2)
		// More than one BatchCheck batch (500) worth of docs, all authorized.
		docs := make([]*resource.BulkIndexItem, 0, 700)
		for i := 0; i < 700; i++ {
			docs = append(docs, newDoc(fmt.Sprintf("doc-%04d", i), "folder-a"))
		}
		indexDocs(t, index, docs)

		ac := &countingAccessClient{allowAll: true}
		names, res := searchNames(t, index, ac, listQuery(100))

		require.Len(t, names, 100, "should return exactly the requested limit")
		// totalHits stays the unfiltered match count.
		require.Equal(t, int64(700), res.TotalHits)
		// Early-exit: we must not have authorized all 700 candidates. With a
		// batch size of 500 the first batch already fills the page of 100.
		require.LessOrEqual(t, ac.checked, 500)
		require.Less(t, ac.checked, 700)
	})

	t.Run("window growth reduces bleve searches for a zero-auth scan", func(t *testing.T) {
		// A zero-auth user can't fill the page, so the scan runs to exhaustion
		// and walks the whole match set. With a constant window the 200-doc
		// match set would take 20 same-sized bleve searches; geometric growth
		// (10 -> 20 -> 40, capped at MaxWindow) covers the same ground in far
		// fewer. Each SearchAfter is a fresh bleve search that re-walks the
		// match set, so fewer windows = less total scoring work.
		cfg := search.PostRankAuthzConfig{OverFetchFactor: 1, MaxWindow: 40}
		index := newTestDashboardsIndexPostRankWithConfig(t, 2, cfg)
		docs := make([]*resource.BulkIndexItem, 0, 200)
		for i := 0; i < 200; i++ {
			docs = append(docs, newDoc(fmt.Sprintf("doc-%03d", i), "denied"))
		}
		indexDocs(t, index, docs)

		ac := &countingAccessClient{allowedFolders: map[string]bool{}} // deny all
		names, res := searchNames(t, index, ac, listQuery(10))

		require.Empty(t, names, "deny-all -> no authorized hits")
		require.Equal(t, int64(0), res.TotalHits, "exhausted -> exact authorized total")
		// Every doc was examined (exhaustion), so candidates == doc count.
		require.Equal(t, 200, ac.checked)
		// Growth: far fewer bleve searches than the 20 a constant window-10
		// scan would issue, but spanning several growing windows (not just one).
		// Windows are small (MaxWindow 40 < FilterAuthorized batch size 500), so
		// batchChecks == number of bleve windows here.
		require.Less(t, ac.batchChecks, 15, "growth should reduce the search count")
		require.GreaterOrEqual(t, ac.batchChecks, 5, "scan should span multiple growing windows")
	})

	t.Run("returns first limit authorized hits in sort order", func(t *testing.T) {
		index := newTestDashboardsIndexPostRank(t, 2)
		// Interleave allowed/denied folders; default list sort is by title asc,
		// and titles equal the (zero-padded) names, so order is deterministic.
		docs := make([]*resource.BulkIndexItem, 0, 20)
		for i := 0; i < 20; i++ {
			folder := "denied"
			if i%2 == 0 {
				folder = "allowed"
			}
			docs = append(docs, newDoc(fmt.Sprintf("doc-%02d", i), folder))
		}
		indexDocs(t, index, docs)

		ac := &countingAccessClient{allowedFolders: map[string]bool{"allowed": true}}
		names, _ := searchNames(t, index, ac, listQuery(3))

		// The first three authorized (even-indexed) docs in title order.
		require.Equal(t, []string{"doc-00", "doc-02", "doc-04"}, names)
	})

	t.Run("relevance query runs through postFilter path", func(t *testing.T) {
		index := newTestDashboardsIndexPostRank(t, 2)
		indexDocs(t, index, []*resource.BulkIndexItem{
			newDoc("alpha", "allowed"),
			newDoc("beta", "denied"),
		})

		ac := &countingAccessClient{allowedFolders: map[string]bool{"allowed": true}}
		q := listQuery(10)
		q.Query = "alpha" // relevance query -> now postFilter, still authz-filtered
		names, _ := searchNames(t, index, ac, q)
		require.Equal(t, []string{"alpha"}, names)
	})

	t.Run("relevance query with sparse auth pages past first window", func(t *testing.T) {
		// Reproduces a bug where query=abd&limit=50 returned zero hits for a
		// scoped user even though authorized matches existed beyond rank 50.
		// The first window is sized to limit (50); score-sorted SearchAfter
		// must still reach authorized hits in later windows.
		index := newTestDashboardsIndexPostRank(t, 2)
		docs := make([]*resource.BulkIndexItem, 0, 80)
		want := make([]string, 0, 6)
		for i := 0; i < 80; i++ {
			name := fmt.Sprintf("doc-%03d", i)
			folder := "denied"
			title := fmt.Sprintf("Abdomen Denied %03d", i)
			if i >= 60 {
				folder = "allowed"
				title = fmt.Sprintf("Abdomen Allowed %03d", i)
				want = append(want, name)
			}
			docs = append(docs, &resource.BulkIndexItem{
				Action: resource.ActionIndex,
				Doc: &resource.IndexableDocument{
					RV:    1,
					Name:  name,
					Title: title,
					Key: &resourcepb.ResourceKey{
						Name:      name,
						Namespace: postRankKey.Namespace,
						Group:     postRankKey.Group,
						Resource:  postRankKey.Resource,
					},
					Folder: folder,
				},
			})
		}
		indexDocs(t, index, docs)

		ac := &countingAccessClient{allowedFolders: map[string]bool{"allowed": true}}
		q := listQuery(50)
		q.Query = "abd"
		names, res := searchNames(t, index, ac, q)
		require.Equal(t, want, names, "authorized matches beyond the first window must be returned")
		require.Equal(t, int64(len(want)), res.TotalHits, "exhausted scan reports exact authorized total")
		require.Greater(t, ac.checked, 50, "must scan past the first window")
	})

	t.Run("fewer authorized than limit returns all authorized", func(t *testing.T) {
		index := newTestDashboardsIndexPostRank(t, 2)
		indexDocs(t, index, []*resource.BulkIndexItem{
			newDoc("doc-0", "allowed"),
			newDoc("doc-1", "denied"),
			newDoc("doc-2", "allowed"),
			newDoc("doc-3", "denied"),
		})
		ac := &countingAccessClient{allowedFolders: map[string]bool{"allowed": true}}
		names, res := searchNames(t, index, ac, listQuery(10))
		require.Equal(t, []string{"doc-0", "doc-2"}, names)
		// The scan exhausts the 4-doc index, so the authorized count (2) is
		// exact and reported as TotalHits — matching the returned page, not the
		// unfiltered match count.
		require.Equal(t, int64(2), res.TotalHits)
	})

	t.Run("no authorized documents returns empty", func(t *testing.T) {
		index := newTestDashboardsIndexPostRank(t, 2)
		indexDocs(t, index, []*resource.BulkIndexItem{
			newDoc("doc-0", "denied"),
			newDoc("doc-1", "denied"),
		})
		ac := &countingAccessClient{allowedFolders: map[string]bool{"allowed": true}}
		names, _ := searchNames(t, index, ac, listQuery(10))
		require.Empty(t, names)
	})

	t.Run("limit larger than total returns everything authorized", func(t *testing.T) {
		index := newTestDashboardsIndexPostRank(t, 2)
		indexDocs(t, index, []*resource.BulkIndexItem{
			newDoc("doc-0", "allowed"),
			newDoc("doc-1", "allowed"),
		})
		ac := &countingAccessClient{allowAll: true}
		names, _ := searchNames(t, index, ac, listQuery(1000))
		require.ElementsMatch(t, []string{"doc-0", "doc-1"}, names)
	})

	t.Run("SearchAfter pages contiguously when all authorized", func(t *testing.T) {
		index := newTestDashboardsIndexPostRank(t, 2)
		docs := make([]*resource.BulkIndexItem, 0, 25)
		want := make([]string, 0, 25)
		for i := 0; i < 25; i++ {
			name := fmt.Sprintf("doc-%02d", i)
			docs = append(docs, newDoc(name, "allowed"))
			want = append(want, name)
		}
		indexDocs(t, index, docs)

		ac := &countingAccessClient{allowedFolders: map[string]bool{"allowed": true}}
		got := pageAll(t, index, ac, 10)
		// Full, ordered coverage with no gaps or duplicates.
		require.Equal(t, want, got)
	})

	t.Run("SearchAfter pages over authorized hits only", func(t *testing.T) {
		index := newTestDashboardsIndexPostRank(t, 2)
		docs := make([]*resource.BulkIndexItem, 0, 30)
		want := make([]string, 0, 15)
		for i := 0; i < 30; i++ {
			name := fmt.Sprintf("doc-%02d", i)
			folder := "denied"
			if i%2 == 0 {
				folder = "allowed"
				want = append(want, name)
			}
			docs = append(docs, newDoc(name, folder))
		}
		indexDocs(t, index, docs)

		ac := &countingAccessClient{allowedFolders: map[string]bool{"allowed": true}}
		got := pageAll(t, index, ac, 4)
		// Only even-indexed docs are authorized; paging must cover exactly those,
		// in order, with no duplicates across page boundaries.
		require.Equal(t, want, got)
	})

	t.Run("offset skips authorized hits on postFilter path", func(t *testing.T) {
		index := newTestDashboardsIndexPostRank(t, 2)
		indexDocs(t, index, []*resource.BulkIndexItem{
			newDoc("doc-0", "allowed"),
			newDoc("doc-1", "allowed"),
			newDoc("doc-2", "allowed"),
		})
		ac := &countingAccessClient{allowAll: true}
		q := listQuery(10)
		q.Offset = 1
		names, _ := searchNames(t, index, ac, q)
		// postFilter applies the offset over the authorized, sorted hits.
		require.Equal(t, []string{"doc-1", "doc-2"}, names)
	})

	t.Run("exhausted scan reports authorized total so offset pagers don't loop", func(t *testing.T) {
		// Reproduces the reported UI bug: a tag filter matches 2 docs but the
		// user is authorized for only 1. The unfiltered total (2) would make the
		// UI keep requesting offset=1 forever; the exhausted scan must report
		// the exact authorized total (1) instead.
		index := newTestDashboardsIndexPostRank(t, 2)
		indexDocs(t, index, []*resource.BulkIndexItem{
			newDoc("doc-0", "allowed"),
			newDoc("doc-1", "denied"),
		})
		ac := &countingAccessClient{allowedFolders: map[string]bool{"allowed": true}}

		q0 := listQuery(50)
		names0, res0 := searchNames(t, index, ac, q0)
		require.Equal(t, []string{"doc-0"}, names0)
		require.Equal(t, int64(1), res0.TotalHits, "exhausted scan reports exact authorized total")

		q1 := listQuery(50)
		q1.Offset = 1
		names1, res1 := searchNames(t, index, ac, q1)
		require.Empty(t, names1)
		require.Equal(t, int64(1), res1.TotalHits, "total stays exact at offset=1 — no phantom 2nd result")
	})

	t.Run("TotalHits on a cursor page that exhausts the tail stays the unfiltered match count", func(t *testing.T) {
		// With req.SearchAfter set, the scan only authorizes the tail beyond the
		// cursor; on exhaustion that's not the whole-query total, so the final
		// short cursor page must fall back to firstRes.Total (unfiltered).
		index := newTestDashboardsIndexPostRank(t, 2)
		const n = 25
		docs := make([]*resource.BulkIndexItem, 0, n)
		for i := 0; i < n; i++ {
			docs = append(docs, newDoc(fmt.Sprintf("doc-%02d", i), "allowed"))
		}
		indexDocs(t, index, docs)
		ac := &countingAccessClient{allowAll: true}

		// Page 1 (no cursor): fills early -> unfiltered total.
		p1, r1 := searchNames(t, index, ac, listQuery(10))
		require.Len(t, p1, 10)
		require.Equal(t, int64(n), r1.TotalHits)

		// Page 2: still fills early -> unfiltered total.
		q2 := listQuery(10)
		q2.SearchAfter = r1.Results.GetRows()[9].SortFields
		p2, r2 := searchNames(t, index, ac, q2)
		require.Len(t, p2, 10)
		require.Equal(t, int64(n), r2.TotalHits)

		// Page 3: the tail (5 docs) exhausts. Pre-fix this reported
		// TotalHits=5 (the tail authorized count); it must stay n (25).
		q3 := listQuery(10)
		q3.SearchAfter = r2.Results.GetRows()[9].SortFields
		p3, r3 := searchNames(t, index, ac, q3)
		require.Len(t, p3, 5)
		require.Equal(t, int64(n), r3.TotalHits, "cursor page must report the unfiltered match count, not the tail authorized count")
	})

	t.Run("low auth fraction continues past MaxCandidates until first authorized hit", func(t *testing.T) {
		// Small cap, with the first authorized hit beyond it. The scan should
		// keep going until it finds that hit, then stop short of the full index.
		cfg := search.PostRankAuthzConfig{MaxWindow: 20, MaxCandidates: 50}
		index := newTestDashboardsIndexPostRankWithConfig(t, 2, cfg)
		docs := make([]*resource.BulkIndexItem, 0, 2000)
		for i := 0; i < 2000; i++ {
			folder := "denied"
			if i == 120 {
				folder = "allowed"
			}
			docs = append(docs, newDoc(fmt.Sprintf("doc-%04d", i), folder))
		}
		indexDocs(t, index, docs)

		ac := &countingAccessClient{allowedFolders: map[string]bool{"allowed": true}}
		q := listQuery(10)
		names1, res1 := searchNames(t, index, ac, q)
		require.Equal(t, []string{"doc-0120"}, names1)
		require.Greater(t, ac.checked, 50, "scan must continue past MaxCandidates while the page is empty")
		require.Less(t, ac.checked, 2000)

		// Determinism: the same bounded scan yields the same partial result.
		ac2 := &countingAccessClient{allowedFolders: map[string]bool{"allowed": true}}
		names2, _ := searchNames(t, index, ac2, q)
		require.Equal(t, names1, names2)
		require.Equal(t, int64(2000), res1.TotalHits, "TotalHits stays the unfiltered match count")
	})

	t.Run("tie-breaker keeps duplicate sort keys contiguous across windows", func(t *testing.T) {
		// Identical titles force the _id tie-breaker to be the only
		// differentiator; a small MaxWindow forces many windows so SearchAfter
		// cursors cross window boundaries repeatedly.
		cfg := search.PostRankAuthzConfig{MaxWindow: 7}
		index := newTestDashboardsIndexPostRankWithConfig(t, 2, cfg)
		const n = 60
		docs := make([]*resource.BulkIndexItem, 0, n)
		want := make([]string, 0, n)
		for i := 0; i < n; i++ {
			name := fmt.Sprintf("doc-%02d", i)
			docs = append(docs, &resource.BulkIndexItem{
				Action: resource.ActionIndex,
				Doc: &resource.IndexableDocument{
					RV:    1,
					Name:  name,
					Title: "same-title", // identical sort key for every doc
					Key: &resourcepb.ResourceKey{
						Name:      name,
						Namespace: postRankKey.Namespace,
						Group:     postRankKey.Group,
						Resource:  postRankKey.Resource,
					},
					Folder: "allowed",
				},
			})
			want = append(want, name)
		}
		indexDocs(t, index, docs)

		ac := &countingAccessClient{allowAll: true}
		got := pageAll(t, index, ac, 10)
		// Full coverage, in _id (name) order, no skips or duplicates across the
		// many windows the bounded scan had to traverse.
		require.Equal(t, want, got)
	})

	t.Run("SearchAfter stays contiguous at scale across windows", func(t *testing.T) {
		cfg := search.PostRankAuthzConfig{MaxWindow: 100}
		index := newTestDashboardsIndexPostRankWithConfig(t, 2, cfg)
		const n = 500
		docs := make([]*resource.BulkIndexItem, 0, n)
		want := make([]string, 0, n)
		for i := 0; i < n; i++ {
			name := fmt.Sprintf("doc-%03d", i)
			docs = append(docs, newDoc(name, "allowed"))
			want = append(want, name)
		}
		indexDocs(t, index, docs)

		ac := &countingAccessClient{allowAll: true}
		got := pageAll(t, index, ac, 50)
		require.Equal(t, want, got, "paging must cover every doc once in order")
	})

	t.Run("folder authz field is not leaked into response columns", func(t *testing.T) {
		// Regression: the post-rank path loads the folder stored field to
		// authorize hits, but that field must not become a response column.
		// Pre-fix, Fields: ["title"] returned title+folder and empty Fields
		// returned only folder (ensureSearchFields skipped the all-fields
		// sentinel because folder was already appended).
		index := newTestDashboardsIndexPostRank(t, 2)
		indexDocs(t, index, []*resource.BulkIndexItem{
			newDoc("doc-0", "allowed"),
			newDoc("doc-1", "denied"),
		})
		ac := &countingAccessClient{allowedFolders: map[string]bool{"allowed": true}}

		// Explicit field set: only the requested column is returned.
		q := listQuery(10)
		q.Fields = []string{"title"}
		_, res := searchNames(t, index, ac, q)
		cols := columnNames(res)
		require.Len(t, cols, 1, "only the requested field should be returned")
		require.NotContains(t, cols, "folder")

		// Empty field set: the all-fields sentinel drives the response (the
		// full standard column set, which includes folder), not just folder.
		_, resAll := searchNames(t, index, ac, listQuery(10))
		colsAll := columnNames(resAll)
		require.NotEmpty(t, colsAll)
		require.Greater(t, len(colsAll), 1, "empty Fields returns the full column set, not just the folder authz field")
	})

	t.Run("stale SearchAfter cursor falls back to in-searcher path", func(t *testing.T) {
		// A cursor created before the flag was enabled has one fewer sort value
		// (no SortDocID tie-breaker). The post-rank path must fall back to the
		// in-searcher path instead of feeding bleve a mismatched cursor.
		index := newTestDashboardsIndexPostRank(t, 2)
		indexDocs(t, index, []*resource.BulkIndexItem{
			newDoc("doc-a", "allowed"),
			newDoc("doc-b", "allowed"),
			newDoc("doc-c", "allowed"),
		})
		ac := &countingAccessClient{allowAll: true}
		// Pre-flag cursor shape: [title, name], no _id tie-breaker. The post-rank
		// sort order is [title, name, _id] (len 3); this cursor is len 2, so it
		// mismatches post-rank and falls back to the in-searcher path, whose sort
		// is [title, name] (len 2) — a match.
		q := listQuery(10)
		q.SearchAfter = []string{"doc-a", "doc-a"}
		names, res := searchNames(t, index, ac, q)
		require.Nil(t, res.Error)
		// Falls back to the in-searcher path; returns docs with (title, name)
		// > ("doc-a", "doc-a").
		require.Equal(t, []string{"doc-b", "doc-c"}, names)
	})

	t.Run("SearchAfter cursor matching neither sort order is rejected", func(t *testing.T) {
		index := newTestDashboardsIndexPostRank(t, 2)
		indexDocs(t, index, []*resource.BulkIndexItem{newDoc("doc-a", "allowed")})
		ac := &countingAccessClient{allowAll: true}
		// len 4 matches neither the post-rank order (3: [title, name, _id]) nor
		// the in-searcher order (2: [title, name]) -> bad request rather than a
		// mismatched bleve search.
		q := listQuery(10)
		q.SearchAfter = []string{"a", "b", "c", "d"}
		res := searchResponse(t, index, ac, q)
		require.NotNil(t, res.Error)
	})
}

// newTestFoldersIndexPostRank builds a folders index with the post-rank-authz
// path enabled and the given tunables (zero values fall back to bleve defaults).
func newTestFoldersIndexPostRank(t testing.TB, size int64, cfg search.PostRankAuthzConfig) resource.ResourceIndex {
	t.Helper()
	key := &resourcepb.ResourceKey{
		Namespace: "default",
		Group:     "folder.grafana.app",
		Resource:  "folders",
	}
	backend, err := search.NewBleveBackend(search.BleveOptions{
		Root:                 t.TempDir(),
		FileThreshold:        threshold, // use in-memory for tests
		PostRankAuthzEnabled: true,
		PostRankAuthz:        cfg,
	}, nil)
	require.NoError(t, err)
	t.Cleanup(backend.Stop)

	ctx := identity.WithRequester(context.Background(), &user.SignedInUser{Namespace: "ns"})
	// Folders use the default (empty) searchable field set, matching bleve_test.go.
	index, err := backend.BuildIndex(ctx, resource.NamespacedResource{
		Namespace: key.Namespace,
		Group:     key.Group,
		Resource:  key.Resource,
	}, size, "test", noop, nil, false, time.Time{}, 0)
	require.NoError(t, err)
	return index
}

func TestSearchPostRankAuthzFederated(t *testing.T) {
	dashKey := &resourcepb.ResourceKey{
		Namespace: "default",
		Group:     "dashboard.grafana.app",
		Resource:  "dashboards",
	}
	folderKey := &resourcepb.ResourceKey{
		Namespace: dashKey.Namespace,
		Group:     "folder.grafana.app",
		Resource:  "folders",
	}

	indexDashboards := func(t *testing.T, index resource.ResourceIndex, docs []*resource.BulkIndexItem) {
		t.Helper()
		require.NoError(t, index.BulkIndex(&resource.BulkIndexRequest{Items: docs}))
	}

	newDash := func(name, title, folder string) *resource.BulkIndexItem {
		return &resource.BulkIndexItem{
			Action: resource.ActionIndex,
			Doc: &resource.IndexableDocument{
				RV:    1,
				Name:  name,
				Title: title,
				Key: &resourcepb.ResourceKey{
					Name:      name,
					Namespace: dashKey.Namespace,
					Group:     dashKey.Group,
					Resource:  dashKey.Resource,
				},
				Folder: folder,
			},
		}
	}

	newFolder := func(name, title string, labels map[string]string) *resource.BulkIndexItem {
		return &resource.BulkIndexItem{
			Action: resource.ActionIndex,
			Doc: &resource.IndexableDocument{
				RV:    1,
				Name:  name,
				Title: title,
				Key: &resourcepb.ResourceKey{
					Name:      name,
					Namespace: folderKey.Namespace,
					Group:     folderKey.Group,
					Resource:  folderKey.Resource,
				},
				Labels: labels,
			},
		}
	}

	// federatedQuery builds a dashboard+folder search request sorted by title.
	federatedQuery := func(limit int64) *resourcepb.ResourceSearchRequest {
		return &resourcepb.ResourceSearchRequest{
			Options: &resourcepb.ListOptions{Key: dashKey},
			Fields:  []string{"title", "_id"},
			Federated: []*resourcepb.ResourceKey{
				folderKey,
			},
			Limit: limit,
			SortBy: []*resourcepb.ResourceSearchRequest_Sort{
				{Field: "title", Desc: false},
			},
		}
	}

	// searchFederated runs a federated query against the dashboards index with the
	// folders index joined in, returning (resource, name) pairs in result order.
	searchFederated := func(t *testing.T, dash, folderIdx resource.ResourceIndex, ac authlib.AccessClient, q *resourcepb.ResourceSearchRequest) ([][2]string, *resourcepb.ResourceSearchResponse) {
		t.Helper()
		requester := &identity.StaticRequester{Type: authlib.TypeUser, UserID: 1, Namespace: dashKey.Namespace}
		ctx := authlib.WithAuthInfo(context.Background(), requester)
		res, err := dash.Search(ctx, ac, q, []resource.ResourceIndex{folderIdx}, nil)
		require.NoError(t, err)
		require.Nil(t, res.Error)
		out := make([][2]string, 0, len(res.Results.GetRows()))
		for _, row := range res.Results.GetRows() {
			out = append(out, [2]string{row.Key.Resource, row.Key.Name})
		}
		return out, res
	}

	pageAllFederated := func(t *testing.T, dash, folderIdx resource.ResourceIndex, ac authlib.AccessClient, limit int64) [][2]string {
		t.Helper()
		var all [][2]string
		var after []string
		for page := 0; ; page++ {
			require.Less(t, page, 1000, "pagination did not terminate")
			q := federatedQuery(limit)
			q.SearchAfter = after
			rows, res := searchFederated(t, dash, folderIdx, ac, q)
			require.LessOrEqual(t, len(rows), int(limit))
			all = append(all, rows...)
			r := res.Results.GetRows()
			if len(r) == 0 {
				break
			}
			after = r[len(r)-1].SortFields
			require.NotEmpty(t, after, "every returned row must carry sort values for the next cursor")
			if len(r) < int(limit) {
				break
			}
		}
		return all
	}

	t.Run("returns dashboards + folders merged in sort order", func(t *testing.T) {
		dash := newTestDashboardsIndexPostRank(t, 2)
		folder := newTestFoldersIndexPostRank(t, 2, search.PostRankAuthzConfig{})
		indexDashboards(t, dash, []*resource.BulkIndexItem{
			newDash("d-bbb", "bbb", "allowed"),
			newDash("d-aaa", "aaa", "allowed"),
		})
		indexDashboards(t, folder, []*resource.BulkIndexItem{
			newFolder("f-zzz", "zzz", nil),
			newFolder("f-mmm", "mmm", nil),
		})

		ac := search.NewStubAccessClient(map[string]bool{"dashboards": true, "folders": true})
		got, res := searchFederated(t, dash, folder, ac, federatedQuery(100))
		// Title-ascending order across both indexes.
		require.Equal(t, [][2]string{
			{"dashboards", "d-aaa"},
			{"dashboards", "d-bbb"},
			{"folders", "f-mmm"},
			{"folders", "f-zzz"},
		}, got)
		require.Equal(t, int64(4), res.TotalHits, "TotalHits is the unfiltered merged match count")
	})

	t.Run("respects permissions per resource type", func(t *testing.T) {
		dash := newTestDashboardsIndexPostRank(t, 2)
		folder := newTestFoldersIndexPostRank(t, 2, search.PostRankAuthzConfig{})
		indexDashboards(t, dash, []*resource.BulkIndexItem{
			newDash("d-aaa", "aaa", "any"),
		})
		indexDashboards(t, folder, []*resource.BulkIndexItem{
			newFolder("f-zzz", "zzz", nil),
		})

		// dashboard-only allowed
		ac := search.NewStubAccessClient(map[string]bool{"dashboards": true, "folders": false})
		got, _ := searchFederated(t, dash, folder, ac, federatedQuery(100))
		require.Equal(t, [][2]string{{"dashboards", "d-aaa"}}, got)

		// folder-only allowed
		ac = search.NewStubAccessClient(map[string]bool{"dashboards": false, "folders": true})
		got, _ = searchFederated(t, dash, folder, ac, federatedQuery(100))
		require.Equal(t, [][2]string{{"folders", "f-zzz"}}, got)

		// none allowed
		ac = search.NewStubAccessClient(map[string]bool{"dashboards": false, "folders": false})
		got, _ = searchFederated(t, dash, folder, ac, federatedQuery(100))
		require.Empty(t, got)
	})

	t.Run("SearchAfter pages across dashboards + folders with no dupes or skips", func(t *testing.T) {
		dash := newTestDashboardsIndexPostRank(t, 2)
		folder := newTestFoldersIndexPostRank(t, 2, search.PostRankAuthzConfig{})
		docs := make([]*resource.BulkIndexItem, 0, 30)
		want := make([][2]string, 0, 30)
		// Interleave titles so the merged sort alternates resources. Titles are
		// zero-padded so the global title order is deterministic.
		for i := 0; i < 15; i++ {
			name := fmt.Sprintf("d-%02d", i)
			title := fmt.Sprintf("t-%02d", i*2)
			docs = append(docs, newDash(name, title, "allowed"))
			want = append(want, [2]string{"dashboards", name})
		}
		indexDashboards(t, dash, docs)

		fdocs := make([]*resource.BulkIndexItem, 0, 15)
		for i := 0; i < 15; i++ {
			name := fmt.Sprintf("f-%02d", i)
			title := fmt.Sprintf("t-%02d", i*2+1)
			fdocs = append(fdocs, newFolder(name, title, nil))
			want = append(want, [2]string{"folders", name})
		}
		indexDashboards(t, folder, fdocs)

		// Sort want by title (the merged sort order). Titles were assigned so that
		// t-00 (d-00), t-01 (f-00), t-02 (d-01), ... interleave perfectly.
		wantSorted := make([][2]string, 0, 30)
		di, fi := 0, 0
		for i := 0; i < 30; i++ {
			if i%2 == 0 {
				wantSorted = append(wantSorted, want[di])
				di++
			} else {
				wantSorted = append(wantSorted, want[15+fi])
				fi++
			}
		}

		ac := search.NewStubAccessClient(map[string]bool{"dashboards": true, "folders": true})
		got := pageAllFederated(t, dash, folder, ac, 7)
		require.Equal(t, wantSorted, got, "paging must cover every doc once, in merged title order")
	})

	t.Run("duplicate sort keys across resources page deterministically via _id", func(t *testing.T) {
		// Identical titles for a dashboard and a folder force the _id tie-breaker
		// to be the only differentiator; a tiny MaxWindow forces many windows so
		// SearchAfter cursors cross window boundaries repeatedly.
		cfg := search.PostRankAuthzConfig{MaxWindow: 5}
		dash := newTestDashboardsIndexPostRankWithConfig(t, 2, cfg)
		folder := newTestFoldersIndexPostRank(t, 2, cfg)
		const n = 12
		docs := make([]*resource.BulkIndexItem, 0, n)
		fdocs := make([]*resource.BulkIndexItem, 0, n)
		// Every doc shares the same title; the _id (resource/name) breaks ties.
		// dashboards sort before folders because "dashboard.grafana.app/dashboards"
		// < "folder.grafana.app/folders" lexicographically in the doc id.
		for i := 0; i < n; i++ {
			dName := fmt.Sprintf("d-%02d", i)
			docs = append(docs, newDash(dName, "same-title", "allowed"))
			fName := fmt.Sprintf("f-%02d", i)
			fdocs = append(fdocs, newFolder(fName, "same-title", nil))
		}
		indexDashboards(t, dash, docs)
		indexDashboards(t, folder, fdocs)

		// Expected global order: all dashboards (by name) then all folders (by
		// name), since the SortDocID tie-breaker orders by the full doc id.
		want := make([][2]string, 0, 2*n)
		for i := 0; i < n; i++ {
			want = append(want, [2]string{"dashboards", fmt.Sprintf("d-%02d", i)})
		}
		for i := 0; i < n; i++ {
			want = append(want, [2]string{"folders", fmt.Sprintf("f-%02d", i)})
		}

		ac := search.NewStubAccessClient(map[string]bool{"dashboards": true, "folders": true})
		got := pageAllFederated(t, dash, folder, ac, 5)
		require.Equal(t, want, got, "duplicate titles must page deterministically by _id across the alias")
	})
}
