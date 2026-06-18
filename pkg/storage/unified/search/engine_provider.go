package search

import (
	"context"
	"fmt"
	"strings"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/engine"
)

type engineProvider struct {
	engine          engine.SearchEngine
	server          *resourceSearchBridge
	skipLegacyIndex bool
}

func (p *engineProvider) Hooks() resource.SearchEngineHooks {
	return resource.SearchEngineHooks{
		Index:           p.index,
		Search:          p.search,
		SkipLegacyIndex: p.skipLegacyIndex,
	}
}

func (p *engineProvider) index(ctx context.Context, key resource.NamespacedResource, items []*resource.BulkIndexItem, rv int64) error {
	schema, hash := p.server.schemaForKey(key)
	indexItems := make([]*resourcepb.IndexItem, 0, len(items))
	for _, item := range items {
		if item == nil {
			continue
		}
		switch item.Action {
		case resource.ActionIndex:
			doc, err := engine.IndexableToDocument(item.Doc)
			if err != nil {
				return err
			}
			indexItems = append(indexItems, &resourcepb.IndexItem{
				Action: resourcepb.IndexItem_ACTION_UPSERT,
				Doc:    doc,
			})
		case resource.ActionDelete:
			indexItems = append(indexItems, &resourcepb.IndexItem{
				Action: resourcepb.IndexItem_ACTION_DELETE,
				Key:    item.Key,
			})
		}
	}
	_, err := p.engine.Index(ctx, &resourcepb.IndexRequest{
		Index:           engine.ToIndexKey(key),
		Schema:          schema,
		SchemaHash:      hash,
		Items:           indexItems,
		ResourceVersion: rv,
	})
	return err
}

func (p *engineProvider) search(ctx context.Context, req *resourcepb.ResourceSearchRequest, stats *resource.SearchStats) (*resourcepb.ResourceSearchResponse, error) {
	engineReq, err := engine.FromResourceSearchRequest(req)
	if err != nil {
		return &resourcepb.ResourceSearchResponse{Error: resource.AsErrorResult(err)}, nil
	}
	checker, err := compileSearchChecker(ctx, p.server.access, req)
	if err != nil {
		return &resourcepb.ResourceSearchResponse{Error: resource.AsErrorResult(err)}, nil
	}
	engineRsp, err := p.engine.Search(ctx, engineReq, checker)
	if err != nil {
		return nil, err
	}
	if engineRsp.Error != nil {
		return &resourcepb.ResourceSearchResponse{Error: engineRsp.Error}, nil
	}
	legacy, err := engine.ToResourceSearchResponse(req, engineRsp)
	if err != nil {
		return &resourcepb.ResourceSearchResponse{Error: resource.AsErrorResult(err)}, nil
	}
	stats.AddTotalHits(int(legacy.TotalHits))
	stats.AddReturnedDocuments(len(legacy.Results.GetRows()))
	return legacy, nil
}

type bleveEngineProvider struct {
	*engineProvider
}

func newBleveEngineProvider(backend *bleveBackend, bridge *resourceSearchBridge) *bleveEngineProvider {
	return &bleveEngineProvider{
		engineProvider: &engineProvider{
			engine: NewBleveSearchEngine(backend),
			server: bridge,
		},
	}
}

func (p *bleveEngineProvider) Engine() engine.SearchEngine {
	return p.engine
}

type elasticEngineProvider struct {
	*engineProvider
}

func newElasticEngineProvider(eng *ElasticSearchEngine, bridge *resourceSearchBridge) *elasticEngineProvider {
	return &elasticEngineProvider{
		engineProvider: &engineProvider{
			engine:          eng,
			server:          bridge,
			skipLegacyIndex: true,
		},
	}
}

func (p *elasticEngineProvider) Engine() engine.SearchEngine {
	return p.engine
}

// resourceSearchBridge exposes read-only searchServer state to the engine
// provider without exporting searchServer from the resource package.
type resourceSearchBridge struct {
	access             authlib.AccessClient
	searchFieldsHashes map[string]string
	getFields          func(key resource.NamespacedResource) resource.SearchableDocumentFields
}

func NewResourceSearchBridge(
	access authlib.AccessClient,
	searchFieldsHashes map[string]string,
	getFields func(key resource.NamespacedResource) resource.SearchableDocumentFields,
) *resourceSearchBridge {
	return &resourceSearchBridge{
		access:             access,
		searchFieldsHashes: searchFieldsHashes,
		getFields:          getFields,
	}
}

func (b *resourceSearchBridge) schemaForKey(key resource.NamespacedResource) ([]*resourcepb.FieldDescriptor, string) {
	return engine.SchemaForKind(key.Group, key.Resource, b.fieldDefinitions(key), b.searchFieldsHashes)
}

func (b *resourceSearchBridge) fieldDefinitions(key resource.NamespacedResource) []resource.SearchFieldDefinition {
	fields := b.getFields(key)
	if fields == nil {
		return nil
	}
	cols := make([]*resourcepb.ResourceTableColumnDefinition, 0, len(fields.Fields()))
	for _, name := range fields.Fields() {
		if col := fields.Field(name); col != nil {
			cols = append(cols, col)
		}
	}
	return resource.SearchFieldsFromTableColumns(cols)
}

func compileSearchChecker(ctx context.Context, access authlib.AccessClient, req *resourcepb.ResourceSearchRequest) (authlib.ItemChecker, error) {
	if access == nil || req.Options == nil || req.Options.Key == nil {
		return nil, nil
	}
	user, ok := authlib.AuthInfoFrom(ctx)
	if !ok || user == nil {
		return nil, nil
	}
	verb := utils.VerbGet
	if req.Permission == int64(dashboardaccess.PERMISSION_EDIT) {
		verb = utils.VerbUpdate
	}
	checker, _, err := access.Compile(ctx, user, authlib.ListRequest{
		Namespace: req.Options.Key.Namespace,
		Group:     req.Options.Key.Group,
		Resource:  req.Options.Key.Resource,
		Verb:      verb,
	})
	return checker, err
}

// CompileSearchCheckerForTest exposes authz compilation for tests.
func CompileSearchCheckerForTest(ctx context.Context, access authlib.AccessClient, req *resourcepb.ResourceSearchRequest) (authlib.ItemChecker, error) {
	return compileSearchChecker(ctx, access, req)
}

func parseElasticsearchAddresses(raw string) []string {
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

func engineIndexError(err error) error {
	if err == nil {
		return nil
	}
	return fmt.Errorf("engine index: %w", err)
}
