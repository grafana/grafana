package semantic

import (
	"context"
	"fmt"
)

// SearchRequest is the input for a semantic search query.
type SearchRequest struct {
	Query     string   `json:"query"`
	Namespace string   `json:"namespace"`
	Limit     int      `json:"limit"`
	MinScore  float32  `json:"min_score"`
	Kinds     []string `json:"kinds"`
}

// SearchResponse is the output of a semantic search query.
type SearchResponse struct {
	Results []SearchResponseItem `json:"results"`
}

// SearchResponseItem is a single hit from semantic search.
type SearchResponseItem struct {
	Group       string  `json:"group"`
	Resource    string  `json:"resource"`
	Name        string  `json:"name"`
	Title       string  `json:"title"`
	Description string  `json:"description"`
	Score       float32 `json:"score"`
}

// Service provides semantic search over Grafana resources.
type Service struct {
	provider EmbeddingProvider
	store    *Store
}

// NewService creates a semantic search service.
func NewService(provider EmbeddingProvider, store *Store) *Service {
	return &Service{
		provider: provider,
		store:    store,
	}
}

// Search embeds the query text and performs cosine similarity search in pgvector.
func (s *Service) Search(ctx context.Context, req SearchRequest) (*SearchResponse, error) {
	if req.Query == "" {
		return nil, fmt.Errorf("query is required")
	}
	if req.Namespace == "" {
		req.Namespace = "default"
	}
	if req.Limit <= 0 {
		req.Limit = 10
	}

	vectors, err := s.provider.EmbedTexts(ctx, []string{req.Query})
	if err != nil {
		return nil, fmt.Errorf("embedding query: %w", err)
	}

	results, err := s.store.Search(ctx, vectors[0], req.Namespace, req.Kinds, req.Limit, req.MinScore)
	if err != nil {
		return nil, fmt.Errorf("searching pgvector: %w", err)
	}

	items := make([]SearchResponseItem, len(results))
	for i, r := range results {
		items[i] = SearchResponseItem{
			Group:       r.Group,
			Resource:    r.Resource,
			Name:        r.Name,
			Title:       r.Title,
			Description: r.Description,
			Score:       r.Score,
		}
	}

	return &SearchResponse{Results: items}, nil
}

// Close cleans up the service resources.
func (s *Service) Close() error {
	return s.store.Close()
}
