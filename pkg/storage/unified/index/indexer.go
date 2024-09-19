package index

import (
	"context"
	"fmt"

	"github.com/blevesearch/bleve/v2"
	"github.com/blevesearch/bleve/v2/mapping"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

type IndexableFields struct {
	kind string
}

type IndexConfig struct {
	ResourceClient resource.ResourceClient
	IndexableFields
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
	resource := bleve.NewDocumentMapping()
	m.AddDocumentMapping("resource", resource)

	kind := bleve.NewDocumentMapping()
	kindFieldMapping := bleve.NewTextFieldMapping()
	resource.AddFieldMappingsAt("kind", kindFieldMapping)
	resource.AddSubDocumentMapping("kind", kind)

	m.DefaultMapping = resource
	return m
}
