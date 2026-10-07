package search

import (
	"maps"
	"slices"

	blevesearch "github.com/blevesearch/bleve/v2/search"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func (b *bleveIndex) matchesAvailable(req *resourcepb.ResourceSearchRequest) bool {
	// The field declarations and feature marker describe this resource's index,
	// not the other resource types in a federated or global search.
	return req.IncludeMatches && len(req.Federated) == 0 && !b.key.IsGlobal() &&
		slices.Contains(b.features, resource.IndexFeatureTextMatchLocations)
}

func matchFieldNamesForMapping(provider resource.SearchFieldsProvider, group, kindResource string) map[string]string {
	names := make(map[string]string)
	for _, field := range declaredFields(provider, group, kindResource) {
		if field.def.Type != resource.SearchFieldTypeString || !field.def.HasCapability(resource.SearchCapabilityText) {
			continue
		}
		names[field.key] = field.key
		if name, ok := keywordVariant(field.def); ok {
			names[field.prefix+name] = field.key
		}
		if name, ok := ngramVariant(field.def); ok {
			names[field.prefix+name] = field.key
		}
	}
	return names
}

func (b *bleveIndex) textMatches(hit *blevesearch.DocumentMatch) map[string][]uint64 {
	fields := make(map[string]map[uint64]struct{})
	for physicalName, terms := range hit.Locations {
		name, ok := b.searchFields.matchFieldNames[physicalName]
		if !ok {
			continue
		}
		indices, ok := fields[name]
		if !ok {
			indices = make(map[uint64]struct{})
			fields[name] = indices
		}
		for _, locations := range terms {
			for _, location := range locations {
				// Declared text fields are scalars or flat string arrays.
				if len(location.ArrayPositions) == 1 {
					indices[location.ArrayPositions[0]] = struct{}{}
				}
			}
		}
	}
	matches := make(map[string][]uint64, len(fields))
	for name, indices := range fields {
		matches[name] = slices.Sorted(maps.Keys(indices))
	}
	return matches
}
