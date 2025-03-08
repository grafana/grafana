package search

import (
	"context"

	"github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

const FOLDER_SCHEMA_VERSION = "schema_version"

type FolderDocumentBuilder struct {
	// Scoped to a single tenant
	Namespace string

	// Cached stats for this namespace
	// maps dashboard UID to stats
	Stats map[string]map[string]int64

	// For large dashboards we will need to load them from blob store
	Blob resource.BlobSupport
}

func FolderdBuilder(namespaced resource.NamespacedDocumentSupplier) (resource.DocumentBuilderInfo, error) {
	fields, err := resource.NewSearchableDocumentFields([]*resource.ResourceTableColumnDefinition{
		{
			Name:        FOLDER_SCHEMA_VERSION,
			Type:        resource.ResourceTableColumnDefinition_INT32,
			Description: "Numeric version saying when the schema was saved",
			Properties: &resource.ResourceTableColumnDefinition_Properties{
				NotNull: true,
			},
		},
	})
	if namespaced == nil {
		namespaced = func(ctx context.Context, namespace string, blob resource.BlobSupport) (resource.DocumentBuilder, error) {
			return &FolderDocumentBuilder{
				Namespace: namespace,
				Blob:      blob,
			}, nil
		}
	}
	return resource.DocumentBuilderInfo{
		GroupResource: v0alpha1.FolderResourceInfo.GroupResource(),
		Fields:        fields,
		Namespaced:    namespaced,
	}, err
}

func (b *FolderDocumentBuilder) BuildDocument(ctx context.Context, key *resource.ResourceKey, rv int64, value []byte) (*resource.IndexableDocument, error) {
	return nil, nil
}
