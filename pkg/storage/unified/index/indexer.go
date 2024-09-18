package index

import (
	"context"
	"fmt"

	"github.com/blevesearch/bleve/v2"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

type IndexableFields struct {
	kind string
}

type IndexConfig struct {
	ResourceClient resource.ResourceClient
	IndexableFields
}

// IndexFromStart indexes selected fields and indexes them, for all resources
// when the server starts.
func (i IndexConfig) IndexFromStart(ctx context.Context) error {
	m := bleve.NewIndexMapping()
	_, err := bleve.New("all_resources", m)
	if err != nil {
		return fmt.Errorf("could not create new bleve index:", err)
	}
	// list all resources
	l, err := i.ResourceClient.List(ctx, &resource.ListRequest{})
	if err != nil {
		return fmt.Errorf("could not list all resources:", err)
	}
	return nil
}
