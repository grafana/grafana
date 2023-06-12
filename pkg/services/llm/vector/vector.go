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
	logger = log.New("vector")

	DataSourceCollectionPrefixTemplate = "grafana-datasource-%s-%s-"

	CoreCollectionPrefix      = "grafana-core-"
	CoreCollectionAlertRules  = fmt.Sprintf("%salert-rules", CoreCollectionPrefix)
	CoreCollectionDashboards  = fmt.Sprintf("%sdashboards", CoreCollectionPrefix)
	CoreCollectionDatasources = fmt.Sprintf("%sdatasources", CoreCollectionPrefix)
	CoreCollectionFolders     = fmt.Sprintf("%sfolders", CoreCollectionPrefix)
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

type RelatedMetadataRequestType string

const (
	RelatedMetadataRequestTypeDatasource RelatedMetadataRequestType = "datasource"
	RelatedMetadataRequestTypeGrafana    RelatedMetadataRequestType = "grafana"
)

type RelatedMetadataRequest struct {
	// The type of metadata request.
	Type RelatedMetadataRequestType `json:"type"`

	// Only used for type == datasource
	// The type of the datasource to fetch metadata for.
	DatasourceType string `json:"datasourceType"`
	// The UID of the datasource to fetch metadata for.
	DatasourceUID string `json:"datasourceUid"`

	// The text to fetch related metadata for.
	Text string `json:"text"`

	// The number of results to return for each collection.
	Limit uint64 `json:"limit"`
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
func (s *Service) RelatedMetadata(ctx context.Context, request RelatedMetadataRequest) (RelatedMetadataResponse, error) {
	embeddings, err := s.llmClient.Embeddings(ctx, request.Text)
	if err != nil {
		return nil, fmt.Errorf("get embeddings: %w", err)
	}
	qdrantClient, cancel, err := NewQdrantClient(s.cfg.LLM.VectorDB.Address)
	if err != nil {
		return nil, fmt.Errorf("create vector store client: %s", err)
	}
	defer cancel()

	var collections []collection
	switch request.Type {
	case RelatedMetadataRequestTypeDatasource:
		collections, err = datasourceCollections(ctx, qdrantClient, request.DatasourceType, request.DatasourceUID)
		if err != nil {
			return nil, err
		}
	case RelatedMetadataRequestTypeGrafana:
		collections = grafanaCollections(ctx)
	default:
		return nil, fmt.Errorf("unsupported metadata request type: %s", request.Type)
	}
	result := make(map[string][]string, len(collections))
	for _, collection := range collections {
		best, err := qdrantClient.Search(ctx, collection.vectorDBName, embeddings, request.Limit)
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
	prefix := fmt.Sprintf(DataSourceCollectionPrefixTemplate, datasourceType, datasourceUID)
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

// grafanaCollections fetches the names of all core Grafana vector collections.
func grafanaCollections(ctx context.Context) []collection {
	return []collection{
		{
			name:         "dashboards",
			vectorDBName: CoreCollectionDashboards,
		},
		{
			name:         "alert-rules",
			vectorDBName: CoreCollectionAlertRules,
		},
		{
			name:         "datasources",
			vectorDBName: CoreCollectionDatasources,
		},
		{
			name:         "folders",
			vectorDBName: CoreCollectionFolders,
		},
	}
}
