package index

import (
	"context"
	"fmt"

	"github.com/blevesearch/bleve/v2"
	"github.com/blevesearch/bleve/v2/mapping"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"google.golang.org/grpc"
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
	// for now listing and indexing syncronously, we can improve this later
	var allResources *resource.ListResponse
	l, err := i.listAllResources(ctx, allResources)
	for _, r := range l.Items {
		err := index.Index(string(r.ResourceVersion), r)
		if err != nil {
			return fmt.Errorf("could not index resource: %w", err)
		}
	}
	return nil
}

func (i *IndexConfig) listAllResources(ctx context.Context, allResources *resource.ListResponse) (*resource.ListResponse, error) {
	l, err := i.ResourceClient.List(ctx, &resource.ListRequest{}, grpc.EmptyCallOption{})
	if err != nil {
		return nil, fmt.Errorf("could not list all resources: %w", err)
	}
	if l == nil {
		return nil, fmt.Errorf("empty list")
	}
	allResources.Items = append(allResources.Items, l.Items...)
	if l.NextPageToken != "" {
		return i.listAllResources(ctx, &resource.ListResponse{NextPageToken: l.NextPageToken, Items: allResources.Items})
	}
	return l, nil
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
