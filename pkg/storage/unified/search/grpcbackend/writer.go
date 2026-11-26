package grpcbackend

import (
	"fmt"
	"maps"
	"slices"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/enginepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/enginequery"
)

// IndexWriter holds the client and field declarations for document writes.
type IndexWriter struct {
	Client      enginepb.SearchEngineClient
	Scope       *enginepb.IndexScope
	Definitions resource.SearchableDocumentFields
}

// PrepareWrite validates and encodes a batch before the caller attempts the RPC.
func (w IndexWriter) PrepareWrite(items []*resource.BulkIndexItem) (*enginepb.WriteDocumentsRequest, error) {
	index, err := writeIndex(w.Scope)
	if err != nil {
		return nil, err
	}
	req := &enginepb.WriteDocumentsRequest{IndexScope: w.Scope}
	fieldIndex := make(map[string]uint32)
	keys := make(map[string]bool, len(items))
	for _, item := range items {
		if item == nil {
			return nil, status.Error(codes.InvalidArgument, "missing index item")
		}
		key := item.Key
		if item.Action == resource.ActionIndex {
			if item.Doc == nil {
				return nil, status.Error(codes.InvalidArgument, "missing document for upsert")
			}
			key = item.Doc.Key
		}
		if key.GetNamespace() != w.Scope.Namespace || key.GetGroup() != index.Group || key.GetResource() != index.Resource || key.GetName() == "" {
			return nil, status.Error(codes.InvalidArgument, "write key does not match index scope")
		}
		if keys[key.Name] {
			return nil, status.Error(codes.InvalidArgument, "duplicate key in write batch")
		}
		keys[key.Name] = true
		switch item.Action {
		case resource.ActionDelete:
			req.Writes = append(req.Writes, deleteDocument(key))
		case resource.ActionIndex:
			doc := item.Doc
			if doc.IsDeleted != nil && *doc.IsDeleted {
				// A soft delete in storage still removes the hit from the live-only index.
				req.Writes = append(req.Writes, deleteDocument(doc.Key))
				continue
			}
			wire := &enginepb.SearchDocument{
				ResourceVersion: doc.RV, Title: doc.Title, Description: doc.Description, Folder: doc.Folder,
				Tags: doc.Tags, Labels: doc.Labels, SelectableFields: doc.SelectableFields, Created: doc.Created, Updated: doc.Updated,
				CreatedBy: doc.CreatedBy, UpdatedBy: doc.UpdatedBy, OwnerReferences: doc.OwnerReferences,
			}
			if doc.Manager != nil {
				wire.ManagerKind, wire.ManagerId, wire.ManagerAllowsEdits = string(doc.Manager.Kind), doc.Manager.Identity, doc.Manager.AllowsEdits
			}
			if doc.Source != nil {
				wire.SourcePath, wire.SourceChecksum, wire.SourceTimestampMillis = doc.Source.Path, doc.Source.Checksum, doc.Source.TimestampMillis
			}
			for _, ref := range doc.References {
				wire.References = append(wire.References, &enginepb.DocumentReference{Kind: ref.Kind, Name: ref.Name})
			}
			for _, name := range slices.Sorted(maps.Keys(doc.Fields)) {
				if doc.Fields[name] == nil {
					continue
				}
				if w.Definitions == nil || w.Definitions.Field(name) == nil {
					return nil, fmt.Errorf("undeclared app field %q", name)
				}
				def := w.Definitions.Field(name)
				i, ok := fieldIndex[name]
				if !ok {
					typ, err := enginequery.FieldValueType(def.Type)
					if err != nil {
						return nil, err
					}
					i = uint32(len(req.Fields))
					fieldIndex[name] = i
					req.Fields = append(req.Fields, &resourcepb.ResourceSearchField{Name: name, Type: typ, IsArray: def.Array})
				}
				value, err := enginequery.NewSearchResultValue(i, *def, doc.Fields[name])
				if err != nil {
					return nil, fmt.Errorf("app field %q: %w", name, err)
				}
				wire.Values = append(wire.Values, value)
			}
			req.Writes = append(req.Writes, &enginepb.DocumentWrite{Key: doc.Key, Action: &enginepb.DocumentWrite_Upsert{Upsert: wire}})
		default:
			return nil, fmt.Errorf("unsupported index action %d", item.Action)
		}
	}
	return req, nil
}

func writeIndex(scope *enginepb.IndexScope) (*enginepb.IndexReference, error) {
	indexes := scope.GetIndexes()
	if scope.GetNamespace() == "" || len(indexes) != 1 {
		return nil, status.Error(codes.InvalidArgument, "write scope must identify one namespaced index generation")
	}
	index := indexes[0]
	if index.GetGroup() == "" || index.GetResource() == "" || index.GetGeneration() == "" || index.GetSchemaRevision() == "" {
		return nil, status.Error(codes.InvalidArgument, "incomplete write index reference")
	}
	return index, nil
}

func deleteDocument(key *resourcepb.ResourceKey) *enginepb.DocumentWrite {
	return &enginepb.DocumentWrite{Key: key, Action: &enginepb.DocumentWrite_Delete{Delete: &emptypb.Empty{}}}
}
