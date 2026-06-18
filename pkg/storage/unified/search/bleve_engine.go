package search

import (
	"context"
	"fmt"
	"sync"
	"time"

	authlib "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/engine"
)

var _ engine.SearchEngine = (*BleveSearchEngine)(nil)

type indexEntry struct {
	index      resource.ResourceIndex
	schemaHash string
	fields     resource.SearchableDocumentFields
}

// BleveSearchEngine implements engine.SearchEngine on top of the existing bleve
// backend. Index lifecycle (build, snapshot, rebuild) stays in bleveBackend;
// this type adds the engine-agnostic wire surface.
type BleveSearchEngine struct {
	backend *bleveBackend
	mu      sync.RWMutex
	indexes map[resource.NamespacedResource]*indexEntry
}

func NewBleveSearchEngine(backend *bleveBackend) *BleveSearchEngine {
	return &BleveSearchEngine{
		backend: backend,
		indexes: make(map[resource.NamespacedResource]*indexEntry),
	}
}

func (e *BleveSearchEngine) Index(ctx context.Context, req *resourcepb.IndexRequest) (*resourcepb.IndexResponse, error) {
	if req == nil || req.Index == nil {
		return &resourcepb.IndexResponse{Error: resource.NewBadRequestError("missing index key")}, nil
	}
	key := engine.IndexKey(req.Index)
	idx, reconciled, err := e.ensureIndex(ctx, key, req.Schema, req.SchemaHash)
	if err != nil {
		return &resourcepb.IndexResponse{Error: resource.AsErrorResult(err)}, nil
	}
	items := make([]*resource.BulkIndexItem, 0, len(req.Items))
	for _, item := range req.Items {
		if item == nil {
			continue
		}
		switch item.Action {
		case resourcepb.IndexItem_ACTION_UPSERT:
			doc, err := engine.DocumentToIndexable(item.Doc)
			if err != nil {
				return &resourcepb.IndexResponse{Error: resource.AsErrorResult(err)}, nil
			}
			items = append(items, &resource.BulkIndexItem{Action: resource.ActionIndex, Doc: doc})
		case resourcepb.IndexItem_ACTION_DELETE:
			k := item.Key
			if k == nil && item.Doc != nil {
				k = item.Doc.Key
			}
			if k == nil {
				return &resourcepb.IndexResponse{Error: resource.NewBadRequestError("delete item missing key")}, nil
			}
			items = append(items, &resource.BulkIndexItem{Action: resource.ActionDelete, Key: k})
		default:
			continue
		}
	}
	if len(items) > 0 {
		if err := idx.BulkIndex(&resource.BulkIndexRequest{
			Items:           items,
			ResourceVersion: req.ResourceVersion,
		}); err != nil {
			return &resourcepb.IndexResponse{Error: resource.AsErrorResult(err)}, nil
		}
	}
	rv := req.ResourceVersion
	if updated, err := idx.UpdateIndex(ctx); err == nil && updated > rv {
		rv = updated
	}
	return &resourcepb.IndexResponse{
		Indexed:          int64(len(items)),
		ResourceVersion:  rv,
		SchemaReconciled: reconciled,
	}, nil
}

func (e *BleveSearchEngine) Search(ctx context.Context, req *resourcepb.SearchRequest, checker authlib.ItemChecker) (*resourcepb.SearchResponse, error) {
	if req == nil || req.Index == nil {
		return &resourcepb.SearchResponse{Error: resource.NewBadRequestError("missing index key")}, nil
	}
	key := engine.IndexKey(req.Index)
	idx, _, err := e.ensureIndex(ctx, key, nil, "")
	if err != nil {
		return &resourcepb.SearchResponse{Error: resource.AsErrorResult(err)}, nil
	}
	legacyReq, err := engine.ToResourceSearchRequest(req)
	if err != nil {
		return &resourcepb.SearchResponse{Error: resource.AsErrorResult(err)}, nil
	}
	var federate []resource.ResourceIndex
	for _, f := range req.Federated {
		if f == nil {
			continue
		}
		fidx, _, err := e.ensureIndex(ctx, engine.IndexKey(f), nil, "")
		if err != nil {
			return &resourcepb.SearchResponse{Error: resource.AsErrorResult(err)}, nil
		}
		federate = append(federate, fidx)
	}
	access := accessClientFromChecker(checker)
	stats := resource.NewSearchStats("engine.Search")
	legacyRsp, err := idx.Search(ctx, access, legacyReq, federate, stats)
	if err != nil {
		return nil, err
	}
	if legacyRsp.Error != nil {
		return &resourcepb.SearchResponse{Error: legacyRsp.Error}, nil
	}
	return engine.FromResourceSearchResponse(legacyRsp)
}

func (e *BleveSearchEngine) Stats(ctx context.Context, req *resourcepb.StatsRequest) (*resourcepb.StatsResponse, error) {
	if req == nil || req.Index == nil {
		return &resourcepb.StatsResponse{Error: resource.NewBadRequestError("missing index key")}, nil
	}
	key := engine.IndexKey(req.Index)
	idx, _, err := e.ensureIndex(ctx, key, nil, "")
	if err != nil {
		return &resourcepb.StatsResponse{Error: resource.AsErrorResult(err)}, nil
	}
	stats := resource.NewSearchStats("engine.Stats")
	if len(req.Folders) == 0 {
		count, err := idx.DocCount(ctx, "", stats)
		if err != nil {
			return &resourcepb.StatsResponse{Error: resource.AsErrorResult(err)}, nil
		}
		return &resourcepb.StatsResponse{Count: count}, nil
	}
	var total int64
	for _, folder := range req.Folders {
		count, err := idx.DocCount(ctx, folder, stats)
		if err != nil {
			return &resourcepb.StatsResponse{Error: resource.AsErrorResult(err)}, nil
		}
		total += count
	}
	return &resourcepb.StatsResponse{Count: total}, nil
}

func (e *BleveSearchEngine) Refresh(ctx context.Context, req *resourcepb.RefreshRequest) (*resourcepb.RefreshResponse, error) {
	if req == nil || req.Index == nil {
		return &resourcepb.RefreshResponse{Error: resource.NewBadRequestError("missing index key")}, nil
	}
	key := engine.IndexKey(req.Index)
	idx, _, err := e.ensureIndex(ctx, key, nil, "")
	if err != nil {
		return &resourcepb.RefreshResponse{Error: resource.AsErrorResult(err)}, nil
	}
	rv, err := idx.UpdateIndex(ctx)
	if err != nil {
		return &resourcepb.RefreshResponse{Error: resource.AsErrorResult(err)}, nil
	}
	if req.ResourceVersion > rv {
		rv = req.ResourceVersion
	}
	return &resourcepb.RefreshResponse{ResourceVersion: rv}, nil
}

func (e *BleveSearchEngine) DeleteIndex(_ context.Context, req *resourcepb.DeleteIndexRequest) (*resourcepb.DeleteIndexResponse, error) {
	if req == nil || req.Index == nil {
		return &resourcepb.DeleteIndexResponse{Error: resource.NewBadRequestError("missing index key")}, nil
	}
	key := engine.IndexKey(req.Index)
	e.mu.Lock()
	delete(e.indexes, key)
	e.mu.Unlock()
	if idx := e.backend.GetIndex(key); idx != nil {
		if closer, ok := idx.(interface{ stopUpdaterAndCloseIndex() error }); ok {
			_ = closer.stopUpdaterAndCloseIndex()
		}
	}
	return &resourcepb.DeleteIndexResponse{}, nil
}

func (e *BleveSearchEngine) Health(_ context.Context, _ *resourcepb.HealthRequest) (*resourcepb.HealthResponse, error) {
	return &resourcepb.HealthResponse{Healthy: true}, nil
}

func (e *BleveSearchEngine) ensureIndex(
	ctx context.Context,
	key resource.NamespacedResource,
	schema []*resourcepb.FieldDescriptor,
	schemaHash string,
) (resource.ResourceIndex, bool, error) {
	if !key.Valid() {
		return nil, false, fmt.Errorf("invalid index key")
	}
	fields, err := engine.SearchableFieldsFromSchema(schema)
	if err != nil {
		return nil, false, err
	}
	e.mu.RLock()
	entry := e.indexes[key]
	e.mu.RUnlock()
	if entry != nil {
		if schemaHash == "" || entry.schemaHash == schemaHash {
			return entry.index, false, nil
		}
	}
	if idx := e.backend.GetIndex(key); idx != nil {
		if schemaHash == "" || (entry != nil && entry.schemaHash == schemaHash) {
			if entry == nil {
				e.mu.Lock()
				e.indexes[key] = &indexEntry{index: idx, schemaHash: schemaHash, fields: fields}
				e.mu.Unlock()
			}
			return idx, false, nil
		}
	}
	reconciled := schemaHash != "" && (entry == nil || entry.schemaHash != schemaHash)
	idx, err := e.backend.BuildIndex(
		ctx,
		key,
		int64(-1),
		fields,
		"engine",
		func(resource.ResourceIndex) (int64, error) { return 0, nil },
		nil,
		reconciled,
		time.Time{},
		0,
	)
	if err != nil {
		return nil, false, err
	}
	e.mu.Lock()
	e.indexes[key] = &indexEntry{index: idx, schemaHash: schemaHash, fields: fields}
	e.mu.Unlock()
	return idx, reconciled, nil
}

type checkerAccessClient struct {
	checker authlib.ItemChecker
}

func accessClientFromChecker(checker authlib.ItemChecker) authlib.AccessClient {
	if checker == nil {
		return nil
	}
	return &checkerAccessClient{checker: checker}
}

func (c *checkerAccessClient) Compile(_ context.Context, _ authlib.AuthInfo, _ authlib.ListRequest) (authlib.ItemChecker, authlib.Zookie, error) {
	return c.checker, nil, nil
}

func (c *checkerAccessClient) Check(_ context.Context, _ authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
	allowed := c.checker(req.Name, folder)
	return authlib.CheckResponse{Allowed: allowed}, nil
}

func (c *checkerAccessClient) BatchCheck(_ context.Context, _ authlib.AuthInfo, _ authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
	return authlib.BatchCheckResponse{}, fmt.Errorf("not implemented")
}
