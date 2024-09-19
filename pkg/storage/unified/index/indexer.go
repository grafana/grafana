package index

import (
	"context"
	"fmt"

	"github.com/blevesearch/bleve/v2"
	"github.com/blevesearch/bleve/v2/mapping"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

type IndexConfig struct {
	ResourceClient resource.ResourceClient
}

// IndexFromBeginning indexes selected fields and indexes them, for all resources
// when the server starts.
func (i IndexConfig) IndexFromBeginning(ctx context.Context) error {
	m := createIndexMapping()
	index, err := bleve.NewMemOnly(m)
	if err != nil {
		return fmt.Errorf("could not create new bleve index: %w", err)
	}
	// list all resources
	l, err := i.ResourceClient.List(ctx, &resource.ListRequest{})
	if err != nil {
		return fmt.Errorf("could not list all resources: %w", err)
	}
	if l == nil {
		return fmt.Errorf("empty list, not indexing")
	}
	for _, r := range l.Items {
		err := index.Index(string(r.ResourceVersion), r)
		if err != nil {
			return fmt.Errorf("could not index resource: %w", err)
		}
	}
	return nil
}

func createIndexMapping() *mapping.IndexMappingImpl {
	m := bleve.NewIndexMapping()
	resourceIndex := bleve.NewDocumentMapping()
	m.AddDocumentMapping("resourceIndexes", resourceIndex)

	resource := bleve.NewDocumentMapping()
	resourceFieldMapping := bleve.NewTextFieldMapping()

	// right now we are only indexing the resource kind
	resourceIndex.AddFieldMappingsAt("resource", resourceFieldMapping)
	resourceIndex.AddSubDocumentMapping("resource", resource)

	m.DefaultMapping = resourceIndex
	return m
}
