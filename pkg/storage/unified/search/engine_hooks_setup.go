package search

import (
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// BleveEngineHooksSetup wires the default BleveSearchEngine into searchServer
// through SearchEngineHooks, keeping bleve lifecycle behind the adapter.
func BleveEngineHooksSetup(cfg resource.EngineSetupConfig) (resource.SearchEngineHooks, error) {
	backend, ok := cfg.Backend.(*bleveBackend)
	if !ok {
		return resource.SearchEngineHooks{}, fmt.Errorf("search engine requires bleve backend, got %T", cfg.Backend)
	}
	bridge := NewResourceSearchBridge(cfg.Access, cfg.SearchFieldsHashes, cfg.GetFields)
	return newBleveEngineProvider(backend, bridge).Hooks(), nil
}

// ElasticEngineHooksSetup wires ElasticSearchEngine into searchServer. Bleve is
// still used for index-build orchestration but reads/writes go to Elasticsearch.
//
// Durability backstop (fast follow): subscribe a search-index consumer to the
// resource server broadcaster (see embed/reconciler) and run periodic
// ListModifiedSince since a checkpoint so missed push-on-write events are
// repaired. All writes use external_gte CAS so push and reconciler are idempotent.
func ElasticEngineHooksSetup(addresses []string, indexPrefix string) resource.EngineProviderSetup {
	return func(cfg resource.EngineSetupConfig) (resource.SearchEngineHooks, error) {
		if len(addresses) == 0 {
			return resource.SearchEngineHooks{}, fmt.Errorf("elasticsearch search engine requires at least one address")
		}
		bridge := NewResourceSearchBridge(cfg.Access, cfg.SearchFieldsHashes, cfg.GetFields)
		eng := NewElasticSearchEngine(addresses, indexPrefix)
		return newElasticEngineProvider(eng, bridge).Hooks(), nil
	}
}

// ElasticEngineHooksSetupFromConfig parses a comma-separated address list.
func ElasticEngineHooksSetupFromConfig(addresses, indexPrefix string) resource.EngineProviderSetup {
	return ElasticEngineHooksSetup(parseElasticsearchAddresses(addresses), indexPrefix)
}

func engineProviderSetup(searchEngineType, elasticsearchAddresses, elasticsearchIndexPrefix string) resource.EngineProviderSetup {
	switch strings.ToLower(searchEngineType) {
	case "elasticsearch", "elastic", "es":
		return ElasticEngineHooksSetupFromConfig(elasticsearchAddresses, elasticsearchIndexPrefix)
	default:
		return BleveEngineHooksSetup
	}
}
