package search_test

import (
	"context"
	"testing"
	"time"

	authlib "github.com/grafana/authlib/types"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search"
	"github.com/grafana/grafana/pkg/storage/unified/search/rerank"
)

func TestHybridSearchBleveTextFields(t *testing.T) {
	key := &resourcepb.ResourceKey{Namespace: "ns", Group: "dashboard.grafana.app", Resource: "dashboards"}
	gvr := schema.GroupVersionResource{Group: key.Group, Resource: key.Resource, Version: "v1"}
	provider := resource.NewMapProvider(map[schema.GroupVersionResource][]resource.SearchFieldDefinition{
		gvr: {
			{Name: "panel_title", Type: resource.SearchFieldTypeString, Array: true, Capabilities: []resource.SearchCapability{resource.SearchCapabilityText, resource.SearchCapabilityRetrieve}},
			{Name: "category", Type: resource.SearchFieldTypeString, Capabilities: []resource.SearchCapability{resource.SearchCapabilityFilter, resource.SearchCapabilityRetrieve}},
		},
	}, map[schema.GroupResource]string{gvr.GroupResource(): gvr.Version})
	fields := resource.NewSearchFieldsRegistry(nil, nil, map[resource.LowerGroupResource]resource.SearchFieldsProvider{
		resource.NewLowerGroupResource(key.Group, key.Resource): provider,
	})
	backend, err := search.NewBleveBackend(search.BleveOptions{
		Root: t.TempDir(), FileThreshold: threshold, SearchFields: fields,
	}, nil)
	require.NoError(t, err)
	t.Cleanup(backend.Stop)
	ctx := authlib.WithAuthInfo(t.Context(), &identity.StaticRequester{
		Type: authlib.TypeUser, UserID: 1, Namespace: key.Namespace,
	})
	index, err := backend.BuildIndex(ctx, resource.NamespacedResource{
		Namespace: key.Namespace, Group: key.Group, Resource: key.Resource,
	}, 3, "test", noop, nil, false, time.Time{}, 0, resource.BuildIndexOptions{})
	require.NoError(t, err)
	for _, doc := range []*resource.IndexableDocument{
		{Name: "description", Title: "Overview", Description: "Investigating DATABASE connection failures"},
		{Name: "panel", Title: "Operations", Fields: map[string]any{"panel_title": []string{"CPU usage", "Database connections"}}},
		{Name: "filter-only", Title: "Unrelated", Fields: map[string]any{"category": "database"}},
	} {
		doc.Key = &resourcepb.ResourceKey{Namespace: key.Namespace, Group: key.Group, Resource: key.Resource, Name: doc.Name}
		require.NoError(t, index.BulkIndex(&resource.BulkIndexRequest{Items: []*resource.BulkIndexItem{
			{Action: resource.ActionIndex, Doc: doc},
		}}))
	}

	for _, tc := range []struct {
		name             string
		rerank           bool
		skipRerank       bool
		noServerRegistry bool
	}{
		{name: "rerank", rerank: true},
		{name: "skip rerank", rerank: true, skipRerank: true},
		{name: "no reranker"},
		{name: "index fields without server registry", rerank: true, noServerRegistry: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			scorer := &hybridTextScorer{}
			var reranker *rerank.Reranker
			if tc.rerank {
				reranker = &rerank.Reranker{Scorer: scorer, Model: "test/model"}
			}
			searchFields := fields
			wantNames := []string{"description", "panel"}
			wantTexts := []string{"Overview\nInvestigating DATABASE connection failures", "Operations\nCPU usage\nDatabase connections"}
			if tc.noServerRegistry {
				searchFields = nil
			}
			server, err := resource.NewUninitializedSearchServer(resource.ResourceServerOptions{
				Backend: resource.UnimplementedStorageBackend{},
				Search: resource.SearchOptions{
					Backend: backend, SearchFields: searchFields,
					Resources: &resource.TestDocumentBuilderSupplier{GroupsResources: map[string]string{key.Group: key.Resource}},
				},
				AccessClient:  authlib.FixedAccessClient(true),
				Reranker:      reranker,
				IndexMetrics:  resource.ProvideIndexMetrics(prometheus.NewRegistry()),
				VectorMetrics: resource.ProvideVectorMetrics(prometheus.NewRegistry()),
			})
			require.NoError(t, err)

			response, err := server.HybridSearch(ctx, &resourcepb.HybridSearchRequest{
				Key: key, Query: "database", SkipRerank: tc.skipRerank,
			})
			require.NoError(t, err)
			require.Len(t, response.Results, len(wantNames))
			names := make([]string, 0, len(response.Results))
			for _, result := range response.Results {
				names = append(names, result.Key.Name)
				require.Len(t, result.Chunks, 1)
				require.Equal(t, result.Title, result.Chunks[0].Content)
			}
			require.ElementsMatch(t, wantNames, names)
			if tc.rerank && !tc.skipRerank {
				require.Equal(t, "database", scorer.query)
				require.ElementsMatch(t, wantTexts, scorer.texts)
			} else {
				require.Empty(t, scorer.texts)
			}
		})
	}
}

func TestHybridSearchBleveTextFieldsFollowIndexRebuild(t *testing.T) {
	key := &resourcepb.ResourceKey{Namespace: "ns", Group: "dashboard.grafana.app", Resource: "dashboards"}
	namespacedResource := resource.NamespacedResource{Namespace: key.Namespace, Group: key.Group, Resource: key.Resource}
	gvr := schema.GroupVersionResource{Group: key.Group, Resource: key.Resource, Version: "v1"}
	kind := resource.NewLowerGroupResource(key.Group, key.Resource)
	panelTitle := resource.SearchFieldDefinition{
		Name: "panel_title", Type: resource.SearchFieldTypeString,
		Capabilities: []resource.SearchCapability{resource.SearchCapabilityText, resource.SearchCapabilityRetrieve},
	}
	summary := resource.SearchFieldDefinition{
		Name: "summary", Type: resource.SearchFieldTypeString,
		Capabilities: []resource.SearchCapability{resource.SearchCapabilityText, resource.SearchCapabilityRetrieve},
	}
	providerA := resource.NewMapProvider(map[schema.GroupVersionResource][]resource.SearchFieldDefinition{gvr: {panelTitle}}, nil)
	providerB := resource.NewMapProvider(map[schema.GroupVersionResource][]resource.SearchFieldDefinition{gvr: {panelTitle, summary}}, nil)
	fields := resource.NewSearchFieldsRegistry(nil, nil, nil)
	backend, err := search.NewBleveBackend(search.BleveOptions{
		Root: t.TempDir(), FileThreshold: threshold, SearchFields: fields,
	}, nil)
	require.NoError(t, err)
	t.Cleanup(backend.Stop)
	ctx := authlib.WithAuthInfo(t.Context(), &identity.StaticRequester{
		Type: authlib.TypeUser, UserID: 1, Namespace: key.Namespace,
	})
	items := make([]*resource.BulkIndexItem, 0, 3)
	for _, doc := range []*resource.IndexableDocument{
		{Name: "title", Title: "Database overview", Fields: map[string]any{"summary": "Recovery guidance"}},
		{Name: "panel", Title: "Operations", Fields: map[string]any{"panel_title": "Database connections"}},
		{Name: "summary", Title: "Observability", Fields: map[string]any{"summary": "Database recovery"}},
	} {
		doc.Key = &resourcepb.ResourceKey{Namespace: key.Namespace, Group: key.Group, Resource: key.Resource, Name: doc.Name}
		items = append(items, &resource.BulkIndexItem{Action: resource.ActionIndex, Doc: doc})
	}
	scorer := &hybridTextScorer{}
	server, err := resource.NewUninitializedSearchServer(resource.ResourceServerOptions{
		Backend: resource.UnimplementedStorageBackend{},
		Search: resource.SearchOptions{
			Backend: backend, SearchFields: fields,
			Resources: &resource.TestDocumentBuilderSupplier{GroupsResources: map[string]string{key.Group: key.Resource}},
		},
		AccessClient:  authlib.FixedAccessClient(true),
		Reranker:      &rerank.Reranker{Scorer: scorer, Model: "test/model"},
		IndexMetrics:  resource.ProvideIndexMetrics(prometheus.NewRegistry()),
		VectorMetrics: resource.ProvideVectorMetrics(prometheus.NewRegistry()),
	})
	require.NoError(t, err)
	wantA := map[string]string{"title": "Database overview", "panel": "Operations\nDatabase connections"}
	wantB := map[string]string{
		"title": "Database overview\nRecovery guidance", "panel": "Operations\nDatabase connections", "summary": "Observability\nDatabase recovery",
	}
	for _, tc := range []struct {
		name        string
		provider    resource.SearchFieldsProvider
		rebuild     bool
		wantTexts   map[string]string
		wantSummary bool
	}{
		{name: "initial index", provider: providerA, rebuild: true, wantTexts: wantA},
		{name: "added field before rebuild", provider: providerB, wantTexts: wantA},
		{name: "added field after rebuild", provider: providerB, rebuild: true, wantTexts: wantB, wantSummary: true},
		{name: "removed fields before rebuild", wantTexts: wantB, wantSummary: true},
		{name: "no manifest fields after rebuild", rebuild: true, wantTexts: map[string]string{"title": "Database overview"}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var providers map[resource.LowerGroupResource]resource.SearchFieldsProvider
			if tc.provider != nil {
				providers = map[resource.LowerGroupResource]resource.SearchFieldsProvider{kind: tc.provider}
			}
			fields.Replace(nil, nil, providers)
			if tc.rebuild {
				_, err := backend.BuildIndex(ctx, namespacedResource, int64(len(items)), "test", func(index resource.ResourceIndex) (int64, error) {
					return 1, index.BulkIndex(&resource.BulkIndexRequest{Items: items})
				}, nil, true, time.Time{}, 0, resource.BuildIndexOptions{})
				require.NoError(t, err)
			}
			scorer.texts = nil
			response, err := server.HybridSearch(ctx, &resourcepb.HybridSearchRequest{Key: key, Query: "database"})
			require.NoError(t, err)
			require.Len(t, response.Results, len(tc.wantTexts))
			for _, result := range response.Results {
				require.Contains(t, tc.wantTexts, result.Key.Name)
				if result.Key.Name == "title" && tc.wantSummary {
					require.Equal(t, "Recovery guidance", result.Lexical["summary"].GetStringValue())
				} else if !tc.wantSummary {
					require.NotContains(t, result.Lexical, "summary")
				}
			}
			wantTexts := make([]string, 0, len(tc.wantTexts))
			for _, text := range tc.wantTexts {
				wantTexts = append(wantTexts, text)
			}
			require.ElementsMatch(t, wantTexts, scorer.texts)
		})
	}
}

type hybridTextScorer struct {
	query string
	texts []string
}

func (s *hybridTextScorer) Score(_ context.Context, query string, texts []string) ([]float64, error) {
	s.query, s.texts = query, texts
	scores := make([]float64, len(texts))
	for i := range scores {
		scores[i] = 0.5
	}
	return scores, nil
}
