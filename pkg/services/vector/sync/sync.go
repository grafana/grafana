// package sync provides a background service to sync metadata from
// Grafana and supported datasources to a configured vector database.
package sync

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"hash/fnv"
	"math"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/vector"
	"github.com/grafana/grafana/pkg/services/vector/embedding"
	"github.com/grafana/grafana/pkg/services/vector/store"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	logger = log.New("vector.sync")
)

type Service struct {
	dashboardService  dashboards.DashboardService
	dataSourceService datasources.DataSourceService
	features          *featuremgmt.FeatureManager

	embeddingClient embedding.Client

	cfg *setting.Cfg
}

func ProvideService(
	dashboardService dashboards.DashboardService,
	dataSourceService datasources.DataSourceService,
	features *featuremgmt.FeatureManager,
	cfg *setting.Cfg,
) *Service {
	ec := embedding.NewClient(cfg.Vector.Embedding)
	return &Service{
		dashboardService:  dashboardService,
		dataSourceService: dataSourceService,
		features:          features,
		embeddingClient:   ec,
		cfg:               cfg,
	}
}

// IsDisabled returns true if the service is disabled.
//
// Satisfies the registry.CanBeDisabled interface which will guarantee
// that Run() is not called if the service is disabled.
func (s *Service) IsDisabled() bool {
	return !s.features.IsEnabled(featuremgmt.FlagVectorSync) || !s.cfg.Vector.Sync.Enabled || s.cfg.Vector.Embedding.Type == "" || s.cfg.Vector.Store.Type == "" || s.embeddingClient == nil
}

func (s *Service) Run(ctx context.Context) error {
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
// Currently only syncs core Grafana metadata.
func (s *Service) syncVectorStore(ctx context.Context) error {
	client, cancel, err := store.NewClient(s.cfg.Vector.Store)
	if err != nil {
		return fmt.Errorf("create vector store client: %s", err)
	}
	if client == nil {
		return fmt.Errorf("got nil vector store client")
	}
	defer cancel()

	if err := s.syncCoreMetadataToVectorStore(ctx, client); err != nil {
		logger.Warn("error syncing core Grafana metadata to vector store", "err", err)
	}

	return nil
}

func (s *Service) syncCoreMetadataToVectorStore(ctx context.Context, client store.Client) error {
	// TODO: improve error handling, this is horrible.

	// Dashboards
	// This doesn't work correctly because searching dashboards using the dashboardService requires a signed in user,
	// but we just want _all_ dashboards. Right now it finds zero dashboards.
	dashboards, dashboardsErr := s.dashboardService.SearchDashboards(ctx, &dashboards.FindPersistedDashboardsQuery{Type: "dash-db", SignedInUser: &user.SignedInUser{}})
	if dashboardsErr == nil {
		metadata := make([]string, 0, len(dashboards))
		for _, dashboard := range dashboards {
			jdoc, err := json.Marshal(dashboard)
			if err != nil {
				logger.Warn("error marshalling dashboard", "dashboardUID", dashboard.UID, "err", err)
				continue
			}
			metadata = append(metadata, string(jdoc))
		}
		dashboardsErr = s.createCollectionIfNotExists(ctx, client, vector.CoreCollectionDashboards)
		if dashboardsErr != nil {
			dashboardsErr = fmt.Errorf("create collection: %w", dashboardsErr)
		}
		if dashboardsErr == nil {
			dashboardsErr = s.addNewMetadata(ctx, client, vector.CoreCollectionDashboards, metadata)
			if dashboardsErr != nil {
				dashboardsErr = fmt.Errorf("add new metadata: %w", dashboardsErr)
			}
		}
	}
	// Datasources
	datasources, datasourcesErr := s.dataSourceService.GetAllDataSources(ctx, &datasources.GetAllDataSourcesQuery{})
	if datasourcesErr == nil {
		metadata := make([]string, 0, len(datasources))
		for _, datasource := range datasources {
			jdoc, err := json.Marshal(datasource)
			if err != nil {
				logger.Warn("error marshalling datasource", "datasourceUID", datasource.UID, "err", err)
				continue
			}
			metadata = append(metadata, string(jdoc))
		}
		datasourcesErr = s.createCollectionIfNotExists(ctx, client, vector.CoreCollectionDatasources)
		if datasourcesErr != nil {
			datasourcesErr = fmt.Errorf("create collection: %w", datasourcesErr)
		}
		if datasourcesErr == nil {
			datasourcesErr = s.addNewMetadata(ctx, client, vector.CoreCollectionDatasources, metadata)
		}
		if datasourcesErr != nil {
			datasourcesErr = fmt.Errorf("add new metadata: %w", datasourcesErr)
		}
	}
	// TODO: add alert rules, folders, annotations, ...
	return errors.Join(dashboardsErr, datasourcesErr)
}

func (s *Service) createCollectionIfNotExists(ctx context.Context, client store.Client, collection string) error {
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
// computing the embedding using the configured embedding engine, then inserting it
// into the configured vector store.
//
// Each piece of metadata is hashed to create a unique ID so we can avoid recomputing
// embeddings for existing metadata.
func (s *Service) addNewMetadata(ctx context.Context, client store.Client, collection string, allMetadata []string) error {
	// IDs are just hashes of the payload
	logger.Debug("adding metadata", "collection", collection, "count", len(allMetadata))
	chunkSize := 100
	if len(allMetadata) == 0 {
		logger.Debug("no new embeddings to add")
		return nil
	}
	for i := 0; i < len(allMetadata); i += chunkSize {
		chunk := allMetadata[i:int(math.Min(float64(i+chunkSize), float64(len(allMetadata))))]
		ids := make([]uint64, 0)
		embeddings := make([][]float32, 0)
		payloads := make([]string, 0)
		for j, metadata := range chunk {
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
			logger.Debug("getting embeddings for metadata", "collection", collection, "metadata", metadata, "index", i+j, "count", len(allMetadata))
			// TODO: we could batch this as well.
			e, err := s.embeddingClient.Embeddings(ctx, metadata)
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
			continue
		}
		logger.Debug("adding embeddings to vector DB", "collection", collection, "count", len(embeddings))
		err := client.UpsertColumnar(ctx, collection, ids, embeddings, payloads)
		if err != nil {
			return fmt.Errorf("upsert columnar: %w", err)
		}
	}
	return nil
}
