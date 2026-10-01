package search

import (
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/search/builders"
)

var documentBuildersLogger = log.New("unified-search-document-builders")

// StandardDocumentBuilders provides the default list of document builders for open source Grafana.
// It combines the standard document builder with external builders for dashboards and users.
type StandardDocumentBuilders struct {
	sql       db.DB
	sprinkles builders.DashboardStats
	kvStore   *kv.ResourceKVStore
}

// ProvideDocumentBuilders returns the DocumentBuilderSupplier used by
// unified storage's search server. kvStore, when non-nil, additionally
// registers the generic KV-sourced builder for every kind that declares
// KV-sourced search fields and does not already have its own builder.
func ProvideDocumentBuilders(sql db.DB, sprinkles builders.DashboardStats, kvStore *kv.ResourceKVStore) resource.DocumentBuilderSupplier {
	return &StandardDocumentBuilders{sql, sprinkles, kvStore}
}

func (s *StandardDocumentBuilders) GetDocumentBuilders(registry *resource.SearchFieldsRegistry) ([]resource.DocumentBuilderInfo, error) {
	all, err := builders.All(registry, s.sql, s.sprinkles)
	if err != nil {
		return nil, err
	}

	result := []resource.DocumentBuilderInfo{ //nolint:prealloc
		{
			Builder: resource.StandardDocumentBuilder(registry),
		},
	}
	result = append(result, all...)

	// skip is every group/resource that already has its own builder
	// (dashboards, users, teams, external group mappings, alert/recording
	// rules): a kind that declares KV-sourced fields but also has a custom
	// builder is never filled twice (see the startup warning below).
	skip := make(map[schema.GroupResource]bool, len(all))
	for _, info := range all {
		if info.GroupResource != (schema.GroupResource{}) {
			skip[info.GroupResource] = true
		}
	}

	// A kind with a custom builder that also declares source.kv
	// fields never gets those fields filled (KVSourcedDocumentBuilders
	// below only builds for kinds in neither `all` nor `skip`) -- almost
	// certainly not what its own kind author intended, so this is
	// surfaced as a startup warning rather than left silent.
	kvSourced := registry.KVSourcedKinds()
	kvSourcedGR := make([]schema.GroupResource, len(kvSourced))
	for i, k := range kvSourced {
		kvSourcedGR[i] = schema.GroupResource(k)
	}
	for _, offender := range builders.KVSourcedKindsWithCustomBuilders(kvSourcedGR, skip) {
		documentBuildersLogger.Warn("kind declares source.kv search fields but has its own custom document builder; its KV-sourced fields are never filled",
			"group", offender.Group, "resource", offender.Resource)
	}

	// Never wrap a nil *kv.ResourceKVStore in the KVSourceReader interface:
	// that produces a non-nil interface value with a nil underlying
	// pointer, which KVSourcedDocumentBuilders' `r == nil` check would miss.
	var reader builders.KVSourceReader
	if s.kvStore != nil {
		reader = s.kvStore
	}
	result = append(result, builders.KVSourcedDocumentBuilders(registry, reader, skip)...)

	return result, nil
}
