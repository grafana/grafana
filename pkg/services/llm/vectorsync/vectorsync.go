// package vectorsync provides a background service to sync metadata from
// Grafana and supported datasources to a configured vector database.
package vectorsync

import (
	"context"
	"fmt"
	"hash/fnv"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/manager/store"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/llm/client"
	"github.com/grafana/grafana/pkg/services/llm/vector"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/adapters"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	logger = log.New("vectorsync")
)

type Service struct {
	dataSourceService datasources.DataSourceService
	pluginService     *store.Service
	pluginClient      plugins.Client

	llmClient client.LLMClient

	cfg *setting.Cfg
}

func ProvideService(
	dataSourceService datasources.DataSourceService,
	pluginService *store.Service,
	pluginClient plugins.Client,
	cfg *setting.Cfg,
) *Service {
	llmClient := client.NewOpenAILLMClient(cfg.LLM)
	return &Service{
		dataSourceService: dataSourceService,
		pluginService:     pluginService,
		pluginClient:      pluginClient,
		llmClient:         llmClient,
		cfg:               cfg,
	}
}

func (s *Service) Run(ctx context.Context) error {
	if s.cfg.LLM.VectorDB.Host == "" {
		logger.Info("no vector db host configured")
		return nil
	}

	s.syncVectorStore(ctx)
	ticker := time.NewTicker(15 * time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
			s.syncVectorStore(ctx)
		}
	}
}

// syncVectorStore syncs the vector store with the latest metadata from Grafana
// and datasources.
//
// Currently only supports qdrant as a vector store and only syncs datasource
// metadata.
func (s *Service) syncVectorStore(ctx context.Context) error {
	datasources, err := s.dataSourceService.GetAllDataSources(ctx, &datasources.GetAllDataSourcesQuery{})
	if err != nil {
		return fmt.Errorf("get datasources: %w", err)
	}
	// TODO: support different types of vector store.
	client, cancel, err := vector.NewQdrantClient(s.cfg.LLM.VectorDB.Host)
	if err != nil {
		return fmt.Errorf("create vector store client: %s", err)
	}
	defer cancel()
	for _, ds := range datasources {
		plugin, found := s.pluginService.Plugin(ctx, ds.Type)
		if !found {
			continue
		}
		if plugin.SupportsVectorStore() {
			if err := s.syncVectorStoreForDatasource(ctx, client, ds); err != nil {
				logger.Warn("sync vector store for datasource", "datasourceName", ds.Name, "datasourceUid", ds.UID, "err", err)
			}
		}
	}
	return nil
}

// syncVectorStoreForDatasource syncs the vector store with the latest metadata from a datasource.
//
// It:
// - fetches metadata from the datasource
// - creates a vector store collection for each collection in the datasource, if one doesn't already exist
// - adds any new metadata to the vector store
func (s *Service) syncVectorStoreForDatasource(ctx context.Context, client vector.VectorClient, ds *datasources.DataSource) error {
	instanceSettings, err := adapters.ModelToInstanceSettings(ds, s.decryptSecureJSONDataFn(ctx))
	if err != nil {
		return fmt.Errorf("convert datasource to instance settings: %w", err)
	}
	metadata, err := s.pluginClient.ProvideMetadata(ctx, &backend.ProvideMetadataRequest{
		PluginContext: backend.PluginContext{
			OrgID:                      ds.OrgID,
			PluginID:                   ds.Type,
			DataSourceInstanceSettings: instanceSettings,
		},
	})
	if err != nil {
		return fmt.Errorf("get vector metadata: %w", err)
	}
	logger.Debug("got vector metadata for datasource", "name", ds.Type, "uid", ds.UID)
	prefix := fmt.Sprintf(vector.DataSourceCollectionPrefixTemplate, ds.Type, ds.UID)
	for cName, cMetadata := range metadata.Metadata {
		collection := fmt.Sprintf("%s%s", prefix, cName)
		err = s.createCollectionIfNotExists(ctx, client, collection)
		if err != nil {
			return fmt.Errorf("create collection: %w", err)
		}
		err = s.addNewMetadata(ctx, client, collection, cMetadata)
		if err != nil {
			return fmt.Errorf("add metadata to vector DB: %w", err)
		}
	}
	return nil
}

func (s *Service) createCollectionIfNotExists(ctx context.Context, client vector.VectorClient, collection string) error {
	if exists, err := client.CollectionExists(ctx, collection); err != nil {
		return fmt.Errorf("check if collection exists: %w", err)
	} else if exists {
		logger.Debug("collection already exists", "collection", collection)
		return nil
	}
	logger.Debug("creating collection", "collection", collection)
	// TODO: make size customizable in config
	return client.CreateCollection(ctx, collection, 1536)
}

// addNewMetadata adds any new metadata to the vector store.
//
// It takes _all_ metadata as an argument, then checks against the vector store
// whether each piece of metadata exists. If it doesn't, it adds it by first
// computing the embedding using the configured LLM service, then inserting it
// into the vector store.
//
// Each piece of metadata is hashed to create a unique ID so we can avoid recomputing
// embeddings for existing metadata.
func (s *Service) addNewMetadata(ctx context.Context, client vector.VectorClient, collection string, allMetadata []string) error {
	// TODO: batch this so we don't try to process every single piece of metadata in memory at once.
	// IDs are just hashes of the payload
	logger.Debug("adding metadata", "collection", collection, "count", len(allMetadata))
	ids := make([]uint64, 0)
	embeddings := make([][]float32, 0)
	payloads := make([]string, 0)
	for _, metadata := range allMetadata {
		hash := fnv.New64a()
		hash.Write([]byte(metadata))
		id := hash.Sum64()
		// TODO: can we do this call in a batch?
		// or does it return 404 if _any_ don't exist?
		// Answer: looks like we can for qdrant at least, the returned array
		// just returns any found IDs.
		if exists, err := client.PointExists(ctx, collection, id); err != nil {
			logger.Warn("check vector exists", "collection", collection, "id", id, "err", err)
			continue
		} else if exists {
			logger.Debug("vector already exists, skipping", "collection", collection, "id", id, "err", err)
			continue
		}
		// If we're here, we have some new metadata to add.
		logger.Debug("getting embeddings for metadata", "collection", collection, "metadata", metadata)
		// TODO: we could batch this as well.
		e, err := s.llmClient.Embeddings(ctx, metadata)
		if err != nil {
			logger.Warn("get embeddings", "collection", collection, "err", err)
			continue
		}
		ids = append(ids, id)
		embeddings = append(embeddings, e)
		payloads = append(payloads, metadata)
	}
	if len(ids) == 0 {
		logger.Debug("no new embeddings to add")
		return nil
	}
	logger.Debug("adding embeddings to vector DB", "count", len(embeddings))
	err := client.UpsertColumnar(ctx, collection, ids, embeddings, payloads)
	if err != nil {
		return fmt.Errorf("upsert columnar: %w", err)
	}
	return nil
}

func (s *Service) decryptSecureJSONDataFn(ctx context.Context) func(ds *datasources.DataSource) (map[string]string, error) {
	return func(ds *datasources.DataSource) (map[string]string, error) {
		return s.dataSourceService.DecryptedValues(ctx, ds)
	}
}
