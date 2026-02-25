// Command search_test_query runs sample semantic search queries to validate quality.
//
// Usage:
//
//	GOOGLE_CLOUD_PROJECT=<project> GOOGLE_CLOUD_LOCATION=us-central1 GOOGLE_GENAI_USE_VERTEXAI=True \
//	go run ./pkg/storage/unified/resource/semantic/testdata/search_test_query.go
package main

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/storage/unified/resource/semantic"
)

func main() {
	ctx := context.Background()

	provider, err := semantic.NewVertexAIProvider(ctx, semantic.VertexAIConfig{})
	if err != nil {
		fmt.Printf("ERROR: %v\n", err)
		return
	}

	store, err := semantic.NewStore("postgres://grafana:grafana@localhost:5433/semantic_search?sslmode=disable", 768)
	if err != nil {
		fmt.Printf("ERROR: %v\n", err)
		return
	}
	defer store.Close()

	queries := []string{
		// No resource mentions "slow queries" or "taking too long" -- should find PostgreSQL/MySQL dashboards
		"why are my queries taking so long",
		// No resource mentions "pods" + "dying" or "crashing" -- should find pod health + crash loop alert
		"my pods keep dying",
		// No resource mentions "money" or "making" -- should find Revenue dashboard
		"how much money are we making",
		// No resource mentions "broken" or "website" -- should find HTTP latency/error dashboards
		"our website is broken and users are complaining",
		// No resource mentions "hack" or "breach" -- should find security/audit dashboards
		"did someone hack into our system",
		// No resource mentions "ship" or "faster" -- should find CI/CD and deployment dashboards
		"how can we ship code faster",
		// No resource mentions "running out of space" -- should find disk dashboard + alert
		"servers are running out of space",
		// No resource mentions "customer" or "leaving" -- should find churn/revenue dashboard
		"customers are leaving and we need to understand why",
	}

	for _, q := range queries {
		vecs, err := provider.EmbedTexts(ctx, []string{q})
		if err != nil {
			fmt.Printf("ERROR embedding %q: %v\n", q, err)
			continue
		}
		results, err := store.Search(ctx, vecs[0], "default", nil, 5, 0)
		if err != nil {
			fmt.Printf("ERROR searching %q: %v\n", q, err)
			continue
		}
		fmt.Printf("\nQuery: %q\n", q)
		for i, r := range results {
			fmt.Printf("  %d. [%.3f] (%s/%s) %s\n", i+1, r.Score, r.Group, r.Resource, r.Title)
		}
	}
}
