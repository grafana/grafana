package search

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/engine"
)

var _ engine.SearchEngine = (*ElasticSearchEngine)(nil)

type esIndexState struct {
	schemaHash string
}

// ElasticSearchEngine implements SearchEngine against Elasticsearch using the
// HTTP API. Mapping is reconciled lazily from schema carried on Index requests.
type ElasticSearchEngine struct {
	client *esClient

	mu      sync.RWMutex
	schemas map[string]*esIndexState
}

func NewElasticSearchEngine(addresses []string, indexPrefix string) *ElasticSearchEngine {
	return &ElasticSearchEngine{
		client:  newESClient(addresses, indexPrefix),
		schemas: make(map[string]*esIndexState),
	}
}

func (e *ElasticSearchEngine) Index(ctx context.Context, req *resourcepb.IndexRequest) (*resourcepb.IndexResponse, error) {
	if req == nil || req.Index == nil {
		return &resourcepb.IndexResponse{Error: resource.NewBadRequestError("missing index key")}, nil
	}
	index := e.client.indexName(indexKeyFromProto(req.Index))
	reconciled, err := e.reconcileSchema(ctx, index, req.Schema, req.SchemaHash)
	if err != nil {
		return &resourcepb.IndexResponse{Error: resource.AsErrorResult(err)}, nil
	}
	if err := e.client.ensureIndex(ctx, index); err != nil {
		return &resourcepb.IndexResponse{Error: resource.AsErrorResult(err)}, nil
	}

	lines := make([]string, 0, len(req.Items)*2)
	for _, item := range req.Items {
		if item == nil {
			continue
		}
		switch item.Action {
		case resourcepb.IndexItem_ACTION_UPSERT:
			if item.Doc == nil || item.Doc.Key == nil {
				continue
			}
			id := esDocID(item.Doc.Key)
			lines = append(lines, mustJSON(map[string]any{
				"index": map[string]any{"_index": index, "_id": id},
			}))
			lines = append(lines, mustJSON(documentToES(item.Doc)))
		case resourcepb.IndexItem_ACTION_DELETE:
			key := item.Key
			if key == nil && item.Doc != nil {
				key = item.Doc.Key
			}
			if key == nil {
				continue
			}
			id := esDocID(key)
			lines = append(lines, mustJSON(map[string]any{
				"delete": map[string]any{"_index": index, "_id": id},
			}))
		}
	}
	if len(lines) > 0 {
		if err := e.client.bulk(ctx, lines, "wait_for"); err != nil {
			return &resourcepb.IndexResponse{Error: resource.AsErrorResult(err)}, nil
		}
	}
	return &resourcepb.IndexResponse{
		Indexed:          int64(len(req.Items)),
		ResourceVersion:  req.ResourceVersion,
		SchemaReconciled: reconciled,
	}, nil
}

func (e *ElasticSearchEngine) Search(ctx context.Context, req *resourcepb.SearchRequest) (*resourcepb.SearchResponse, error) {
	if req == nil || req.Index == nil {
		return &resourcepb.SearchResponse{Error: resource.NewBadRequestError("missing index key")}, nil
	}
	if err := e.ensureSearchIndices(ctx, req); err != nil {
		return &resourcepb.SearchResponse{Error: resource.AsErrorResult(err)}, nil
	}
	index := e.searchIndexNames(req)
	body := esSearchBody(req)

	raw, err := e.client.search(ctx, index, body)
	if err != nil {
		return &resourcepb.SearchResponse{Error: resource.AsErrorResult(err)}, nil
	}
	return parseESSearchResponse(raw, req)
}

func (e *ElasticSearchEngine) searchIndexNames(req *resourcepb.SearchRequest) string {
	names := []string{e.client.indexName(indexKeyFromProto(req.Index))}
	for _, f := range req.Federated {
		if f == nil {
			continue
		}
		names = append(names, e.client.indexName(indexKeyFromProto(f)))
	}
	return strings.Join(names, ",")
}

func (e *ElasticSearchEngine) ensureSearchIndices(ctx context.Context, req *resourcepb.SearchRequest) error {
	if err := e.client.ensureIndex(ctx, e.client.indexName(indexKeyFromProto(req.Index))); err != nil {
		return err
	}
	for _, f := range req.Federated {
		if f == nil {
			continue
		}
		if err := e.client.ensureIndex(ctx, e.client.indexName(indexKeyFromProto(f))); err != nil {
			return err
		}
	}
	return nil
}

func (e *ElasticSearchEngine) Stats(ctx context.Context, req *resourcepb.StatsRequest) (*resourcepb.StatsResponse, error) {
	if req == nil || req.Index == nil {
		return &resourcepb.StatsResponse{Error: resource.NewBadRequestError("missing index key")}, nil
	}
	index := e.client.indexName(indexKeyFromProto(req.Index))
	if len(req.Folders) == 0 {
		count, err := e.client.count(ctx, index, map[string]any{"query": map[string]any{"match_all": map[string]any{}}})
		if err != nil {
			return &resourcepb.StatsResponse{Error: resource.AsErrorResult(err)}, nil
		}
		return &resourcepb.StatsResponse{Count: count}, nil
	}
	var total int64
	for _, folder := range req.Folders {
		count, err := e.client.count(ctx, index, map[string]any{
			"query": map[string]any{"term": map[string]any{"folder": folder}},
		})
		if err != nil {
			return &resourcepb.StatsResponse{Error: resource.AsErrorResult(err)}, nil
		}
		total += count
	}
	return &resourcepb.StatsResponse{Count: total}, nil
}

func (e *ElasticSearchEngine) Refresh(ctx context.Context, req *resourcepb.RefreshRequest) (*resourcepb.RefreshResponse, error) {
	if req == nil || req.Index == nil {
		return &resourcepb.RefreshResponse{Error: resource.NewBadRequestError("missing index key")}, nil
	}
	index := e.client.indexName(indexKeyFromProto(req.Index))
	if err := e.client.refresh(ctx, index); err != nil {
		return &resourcepb.RefreshResponse{Error: resource.AsErrorResult(err)}, nil
	}
	return &resourcepb.RefreshResponse{ResourceVersion: req.ResourceVersion}, nil
}

func (e *ElasticSearchEngine) DeleteIndex(ctx context.Context, req *resourcepb.DeleteIndexRequest) (*resourcepb.DeleteIndexResponse, error) {
	if req == nil || req.Index == nil {
		return &resourcepb.DeleteIndexResponse{Error: resource.NewBadRequestError("missing index key")}, nil
	}
	index := e.client.indexName(indexKeyFromProto(req.Index))
	e.mu.Lock()
	delete(e.schemas, index)
	e.mu.Unlock()
	if err := e.client.deleteIndex(ctx, index); err != nil {
		return &resourcepb.DeleteIndexResponse{Error: resource.AsErrorResult(err)}, nil
	}
	return &resourcepb.DeleteIndexResponse{}, nil
}

func (e *ElasticSearchEngine) Health(_ context.Context, _ *resourcepb.HealthRequest) (*resourcepb.HealthResponse, error) {
	return &resourcepb.HealthResponse{Healthy: e.client != nil && e.client.baseURL != ""}, nil
}

func (e *ElasticSearchEngine) reconcileSchema(ctx context.Context, index string, schema []*resourcepb.FieldDescriptor, schemaHash string) (bool, error) {
	if schemaHash == "" {
		return false, nil
	}
	e.mu.RLock()
	state := e.schemas[index]
	e.mu.RUnlock()
	if state != nil && state.schemaHash == schemaHash {
		return false, nil
	}
	if err := e.client.ensureIndex(ctx, index); err != nil {
		return false, err
	}
	mapping := esMappingFromSchema(schema)
	if err := e.client.putMapping(ctx, index, mapping); err != nil {
		return false, err
	}
	e.mu.Lock()
	e.schemas[index] = &esIndexState{schemaHash: schemaHash}
	e.mu.Unlock()
	return true, nil
}

func indexKeyFromProto(key *resourcepb.ResourceIndexKey) resourceIndexKey {
	if key == nil {
		return resourceIndexKey{}
	}
	return resourceIndexKey{
		Namespace: key.Namespace,
		Group:     key.Group,
		Resource:  key.Resource,
	}
}

func mustJSON(v any) string {
	raw, err := json.Marshal(v)
	if err != nil {
		panic(fmt.Sprintf("json marshal: %v", err))
	}
	return string(raw)
}
