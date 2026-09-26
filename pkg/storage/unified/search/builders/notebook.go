package builders

import (
	"context"
	"encoding/json"
	"fmt"

	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

const notebookContentField = "content"

func NotebookBuilder(registry *resource.SearchFieldsRegistry) resource.DocumentBuilderInfo {
	return resource.DocumentBuilderInfo{
		GroupResource: dashv2beta1.NotebookResourceInfo.GroupResource(),
		Namespaced: func(_ context.Context, _ string, blob resource.BlobSupport) (resource.DocumentBuilder, error) {
			return &notebookDocumentBuilder{declared: resource.StandardDocumentBuilder(registry), blob: blob}, nil
		},
	}
}

type notebookDocumentBuilder struct {
	declared resource.DocumentBuilder
	blob     resource.BlobSupport
}

func (builder *notebookDocumentBuilder) BuildDocument(ctx context.Context, key *resourcepb.ResourceKey, rv int64, value []byte) (*resource.IndexableDocument, error) {
	metadata, err := unmarshalMetadataOnly(value)
	if err != nil {
		return nil, err
	}
	accessor, err := utils.MetaAccessor(metadata)
	if err != nil {
		return nil, err
	}
	if info := accessor.GetBlob(); info != nil {
		if builder.blob == nil {
			return nil, fmt.Errorf("notebook blob storage is unavailable")
		}
		rsp, err := builder.blob.GetResourceBlob(ctx, key, info, true)
		if err != nil {
			return nil, fmt.Errorf("reading notebook blob: %w", err)
		}
		if err := resource.ErrorFromResponse(rsp.GetError(), nil); err != nil {
			return nil, fmt.Errorf("reading notebook blob: %w", err)
		}
		value = rsp.Value
	}

	doc, err := builder.declared.BuildDocument(ctx, key, rv, value)
	if err != nil {
		return nil, err
	}
	var notebook dashv2beta1.Notebook
	if err := json.Unmarshal(value, &notebook); err != nil {
		return nil, err
	}

	content := make([]string, 0, len(notebook.Spec.Layout.Spec.Cells))
	for _, item := range notebook.Spec.Layout.Spec.Cells {
		element, ok := notebook.Spec.Elements[item.Spec.Element.Name]
		if !ok || element.CellKind == nil {
			continue
		}
		cell := element.CellKind.Spec.Content
		if cell.MarkdownCellContentKind != nil {
			content = append(content, cell.MarkdownCellContentKind.Spec.Text)
		} else if cell.CodeCellContentKind != nil {
			content = append(content, cell.CodeCellContentKind.Spec.Code)
		}
	}
	if len(content) > 0 {
		if doc.Fields == nil {
			doc.Fields = make(map[string]any)
		}
		doc.Fields[notebookContentField] = content
	}
	return doc, nil
}
