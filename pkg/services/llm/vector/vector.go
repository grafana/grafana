// package vector provides a service for fetching metadata related to
// a natural language query.
//
// Currently it's not general enough and only supports fetching metadata
// related to datasources; in future we should support fetching related
// dashboards, folders, alerts, etc (stuff related to Grafana itself).

package vector

import (
	"context"
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/llm/client"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	logger                       = log.New("vector")
	DataSourceCollectionTemplate = "grafana-datasource-%s-%s-"
)

// TODO: make this an interface
type Service struct {
	llmClient client.LLMClient
	cfg       *setting.Cfg
}

func ProvideService(
	cfg *setting.Cfg,
) *Service {
	llmClient := client.NewOpenAILLMClient(cfg.LLM)
	return &Service{
		llmClient: llmClient,
		cfg:       cfg,
	}
}

type RelatedMetadataResponse = map[string][]string

// RelatedMetadata returns metadata related to the given text.
//
// Each datasource can have multiple vector collections in the vector database,
// named using the convention "grafana-datasource-{type}-{uid}-{collection}".
// The datasource's `ProvideMetadata` method should return a map from collection
// names to slices of text, which will be indexed into the vector database by the
// vectorsync job.
//
// This method will return a map from collection names to the closest `limit` matches
// in each of the datasources' collections.
func (s *Service) RelatedMetadata(ctx context.Context, datasourceType, datasourceUID, text string, limit uint64) (RelatedMetadataResponse, error) {
	embeddings, err := s.llmClient.Embeddings(ctx, text)
	if err != nil {
		return nil, fmt.Errorf("get embeddings: %w", err)
	}
	qdrantClient, cancel, err := NewQdrantClient(s.cfg.LLM.VectorDB.Host)
	if err != nil {
		return nil, fmt.Errorf("create vector store client: %s", err)
	}
	defer cancel()
	collections, err := datasourceCollections(ctx, qdrantClient, datasourceType, datasourceUID)
	result := make(map[string][]string, len(collections))
	for _, collection := range collections {
		best, err := qdrantClient.Search(ctx, collection.vectorDBName, embeddings, limit)
		if err != nil {
			logger.Error("error searching vector collection for closest matches", "collection", collection, "error", err)
			continue
		}
		result[collection.name] = best
	}
	return result, nil
}

type collection struct {
	name         string
	vectorDBName string
}

// datasourceCollections fetches the names of all vector collections for the given datasource.
func datasourceCollections(ctx context.Context, client VectorClient, datasourceType, datasourceUID string) ([]collection, error) {
	allCollections, err := client.Collections(ctx)
	if err != nil {
		return nil, err
	}
	prefix := fmt.Sprintf(DataSourceCollectionTemplate, datasourceType, datasourceUID)
	collections := make([]collection, 0)
	for _, c := range allCollections {
		if !strings.HasPrefix(c, prefix) {
			continue
		}
		collection := collection{
			name:         strings.TrimPrefix(c, prefix),
			vectorDBName: c,
		}

		collections = append(collections, collection)
	}
	return collections, nil
}
