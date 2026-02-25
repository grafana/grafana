// Command index reads all resources from a Grafana instance via the HTTP API,
// generates embeddings using Vertex AI, and stores them in pgvector.
//
// Usage:
//
//	GOOGLE_CLOUD_PROJECT=<project> GOOGLE_CLOUD_LOCATION=us-central1 GOOGLE_GENAI_USE_VERTEXAI=True \
//	go run ./pkg/storage/unified/resource/semantic/testdata/index.go
package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/storage/unified/resource/semantic"
)

var (
	grafanaURL  = flag.String("grafana-url", "http://localhost:3000", "Grafana base URL")
	postgresURL = flag.String("postgres-url", "postgres://grafana:grafana@localhost:5433/semantic_search?sslmode=disable", "pgvector PostgreSQL URL")
	user        = flag.String("user", "admin", "Grafana admin username")
	pass        = flag.String("pass", "admin", "Grafana admin password")
	batchSize   = flag.Int("batch-size", 50, "Number of texts to embed per Vertex AI call")
)

// resource is a unified representation of any Grafana resource for embedding.
type resource struct {
	Namespace    string
	Group        string
	ResourceKind string
	Name         string
	Title        string
	Description  string
	Tags         []string
	Extra        map[string]string
}

// embeddingText builds the text that will be embedded for this resource.
func (r resource) embeddingText() string {
	var b strings.Builder
	b.WriteString(r.Title)
	if r.Description != "" {
		b.WriteString(". ")
		b.WriteString(r.Description)
	}
	if len(r.Tags) > 0 {
		b.WriteString(". Tags: ")
		b.WriteString(strings.Join(r.Tags, ", "))
	}
	for k, v := range r.Extra {
		b.WriteString(". ")
		b.WriteString(k)
		b.WriteString(": ")
		b.WriteString(v)
	}
	return b.String()
}

func main() {
	flag.Parse()
	ctx := context.Background()

	fmt.Println("=== Semantic Search Indexer ===")

	// 1. Collect all resources from Grafana APIs.
	fmt.Println("\nFetching resources from Grafana...")
	resources := fetchAllResources()
	fmt.Printf("Found %d resources total\n", len(resources))

	if len(resources) == 0 {
		fmt.Println("No resources to index.")
		return
	}

	// 2. Initialize Vertex AI embedding provider.
	fmt.Println("\nInitializing Vertex AI embedding provider...")
	provider, err := semantic.NewVertexAIProvider(ctx, semantic.VertexAIConfig{})
	if err != nil {
		fmt.Printf("ERROR creating embedding provider: %v\n", err)
		return
	}
	fmt.Printf("Using %d-dimensional embeddings\n", provider.Dimensions())

	// 3. Initialize pgvector store.
	fmt.Println("\nConnecting to pgvector...")
	store, err := semantic.NewStore(*postgresURL, provider.Dimensions())
	if err != nil {
		fmt.Printf("ERROR connecting to pgvector: %v\n", err)
		return
	}
	defer store.Close()
	fmt.Println("Connected to pgvector")

	// 4. Build texts and embed in batches.
	fmt.Printf("\nEmbedding %d resources in batches of %d...\n", len(resources), *batchSize)
	start := time.Now()

	var records []semantic.EmbeddingRecord
	for i := 0; i < len(resources); i += *batchSize {
		end := i + *batchSize
		if end > len(resources) {
			end = len(resources)
		}
		batch := resources[i:end]

		texts := make([]string, len(batch))
		for j, r := range batch {
			texts[j] = r.embeddingText()
		}

		fmt.Printf("  Embedding batch %d-%d (%d items)...", i, end, len(batch))
		vectors, err := provider.EmbedTexts(ctx, texts)
		if err != nil {
			fmt.Printf(" ERROR: %v\n", err)
			return
		}
		fmt.Printf(" done\n")

		for j, r := range batch {
			records = append(records, semantic.EmbeddingRecord{
				Namespace:   r.Namespace,
				Group:       r.Group,
				Resource:    r.ResourceKind,
				Name:        r.Name,
				Title:       r.Title,
				Description: r.Description,
				Embedding:   vectors[j],
			})
		}
	}

	// 5. Upsert into pgvector.
	fmt.Printf("\nUpserting %d embeddings into pgvector...", len(records))
	if err := store.UpsertEmbeddings(ctx, records); err != nil {
		fmt.Printf(" ERROR: %v\n", err)
		return
	}
	fmt.Printf(" done\n")

	elapsed := time.Since(start)
	fmt.Printf("\n=== Indexed %d resources in %s ===\n", len(records), elapsed.Round(time.Millisecond))

	// 6. Print summary by type.
	counts := map[string]int{}
	for _, r := range resources {
		counts[r.Group+"/"+r.ResourceKind]++
	}
	fmt.Println("\nResources indexed:")
	for kind, count := range counts {
		fmt.Printf("  %-50s %d\n", kind, count)
	}
}

func fetchAllResources() []resource {
	var all []resource
	all = append(all, fetchDashboardsAndFolders()...)
	all = append(all, fetchDatasources()...)
	all = append(all, fetchAlertRules()...)
	all = append(all, fetchPlaylists()...)
	return all
}

func fetchDashboardsAndFolders() []resource {
	body := grafanaGet("/api/search?limit=5000")
	var items []struct {
		UID         string   `json:"uid"`
		Title       string   `json:"title"`
		Description string   `json:"description"`
		Type        string   `json:"type"`
		Tags        []string `json:"tags"`
		FolderTitle string   `json:"folderTitle"`
	}
	if err := json.Unmarshal(body, &items); err != nil {
		fmt.Printf("  ERROR parsing search results: %v\n", err)
		return nil
	}

	var resources []resource
	for _, item := range items {
		r := resource{
			Namespace:   "default",
			Name:        item.UID,
			Title:       item.Title,
			Description: item.Description,
			Tags:        item.Tags,
		}
		if item.FolderTitle != "" {
			r.Extra = map[string]string{"folder": item.FolderTitle}
		}

		switch item.Type {
		case "dash-folder":
			r.Group = "folder.grafana.app"
			r.ResourceKind = "folders"
		case "dash-db":
			r.Group = "dashboard.grafana.app"
			r.ResourceKind = "dashboards"
		default:
			continue
		}
		resources = append(resources, r)
	}
	fmt.Printf("  Dashboards & folders: %d\n", len(resources))
	return resources
}

func fetchDatasources() []resource {
	body := grafanaGet("/api/datasources")
	var items []struct {
		UID      string `json:"uid"`
		Name     string `json:"name"`
		Type     string `json:"type"`
		TypeName string `json:"typeName"`
	}
	if err := json.Unmarshal(body, &items); err != nil {
		fmt.Printf("  ERROR parsing datasources: %v\n", err)
		return nil
	}

	var resources []resource
	for _, item := range items {
		resources = append(resources, resource{
			Namespace:    "default",
			Group:        "datasource.grafana.app",
			ResourceKind: "datasources",
			Name:         item.UID,
			Title:        item.Name,
			Description:  fmt.Sprintf("%s data source (%s)", item.TypeName, item.Type),
		})
	}
	fmt.Printf("  Datasources: %d\n", len(resources))
	return resources
}

func fetchAlertRules() []resource {
	body := grafanaGet("/api/v1/provisioning/alert-rules")
	var items []struct {
		UID       string `json:"uid"`
		Title     string `json:"title"`
		RuleGroup string `json:"ruleGroup"`
		FolderUID string `json:"folderUID"`
	}
	if err := json.Unmarshal(body, &items); err != nil {
		fmt.Printf("  ERROR parsing alert rules: %v\n", err)
		return nil
	}

	var resources []resource
	for _, item := range items {
		resources = append(resources, resource{
			Namespace:    "default",
			Group:        "alerting.grafana.app",
			ResourceKind: "alertrules",
			Name:         item.UID,
			Title:        item.Title,
			Extra:        map[string]string{"rule_group": item.RuleGroup},
		})
	}
	fmt.Printf("  Alert rules: %d\n", len(resources))
	return resources
}

func fetchPlaylists() []resource {
	body := grafanaGet("/api/playlists")
	var items []struct {
		UID  string `json:"uid"`
		Name string `json:"name"`
	}
	if err := json.Unmarshal(body, &items); err != nil {
		fmt.Printf("  ERROR parsing playlists: %v\n", err)
		return nil
	}

	var resources []resource
	for _, item := range items {
		resources = append(resources, resource{
			Namespace:    "default",
			Group:        "playlist.grafana.app",
			ResourceKind: "playlists",
			Name:         item.UID,
			Title:        item.Name,
		})
	}
	fmt.Printf("  Playlists: %d\n", len(resources))
	return resources
}

func grafanaGet(path string) []byte {
	req, _ := http.NewRequest("GET", *grafanaURL+path, nil)
	req.SetBasicAuth(*user, *pass)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		fmt.Printf("  ERROR GET %s: %v\n", path, err)
		return nil
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode >= 400 {
		fmt.Printf("  ERROR GET %s: [%d] %s\n", path, resp.StatusCode, string(body))
		return nil
	}
	return body
}
