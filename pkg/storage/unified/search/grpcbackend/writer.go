package grpcbackend

import (
	"fmt"
	"maps"
	"slices"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"
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

const (
	maxWriteDocuments = 1000
	// Match gRPC's default server receive limit for the serialized message.
	maxWriteRequestBytes = 4 << 20
)

// PrepareBatches validates the entire bulk request before sending any RPC.
func (w IndexWriter) PrepareBatches(items []*resource.BulkIndexItem) ([]*enginepb.WriteDocumentsRequest, error) {
	index, err := writeIndex(w.Scope)
	if err != nil {
		return nil, err
	}
	var requests []*enginepb.WriteDocumentsRequest
	for chunk := range slices.Chunk(items, maxWriteDocuments) {
		// Repeated keys must be sent in separate requests without changing their order.
		start := 0
		seen := make(map[string]bool, len(chunk))
		for n, item := range chunk {
			key := writeKey(item)
			if key.GetNamespace() != w.Scope.Namespace || key.GetGroup() != index.Group || key.GetResource() != index.Resource || key.GetName() == "" {
				return nil, status.Error(codes.InvalidArgument, "write key does not match index scope")
			}
			if seen[key.Name] {
				requests, err = w.appendBatches(requests, chunk[start:n])
				if err != nil {
					return nil, err
				}
				start = n
				clear(seen)
			}
			seen[key.Name] = true
		}
		requests, err = w.appendBatches(requests, chunk[start:])
		if err != nil {
			return nil, err
		}
	}
	return requests, nil
}

func writeKey(item *resource.BulkIndexItem) *resourcepb.ResourceKey {
	if item == nil {
		return nil
	}
	if item.Action == resource.ActionIndex {
		if item.Doc == nil {
			return nil
		}
		return item.Doc.Key
	}
	return item.Key
}

func (w IndexWriter) appendBatches(requests []*enginepb.WriteDocumentsRequest, items []*resource.BulkIndexItem) ([]*enginepb.WriteDocumentsRequest, error) {
	req, err := w.prepareWrite(items)
	if err != nil {
		return nil, err
	}
	if proto.Size(req) <= maxWriteRequestBytes {
		return append(requests, req), nil
	}
	if len(items) == 1 {
		return nil, status.Error(codes.ResourceExhausted, "one document exceeds the gRPC write request size limit")
	}
	// Re-encode each half so field declarations and indexes match its documents.
	mid := len(items) / 2
	requests, err = w.appendBatches(requests, items[:mid])
	if err != nil {
		return nil, err
	}
	return w.appendBatches(requests, items[mid:])
}

func (w IndexWriter) prepareWrite(items []*resource.BulkIndexItem) (*enginepb.WriteDocumentsRequest, error) {
	req := &enginepb.WriteDocumentsRequest{IndexScope: w.Scope}
	fieldIndex := make(map[string]uint32)
	for _, item := range items {
		switch item.Action {
		case resource.ActionDelete:
			req.Writes = append(req.Writes, deleteDocument(item.Key))
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
				var def *resource.SearchFieldDefinition
				if w.Definitions != nil {
					def = w.Definitions.Field(name)
				}
				if def == nil {
					return nil, fmt.Errorf("undeclared app field %q", name)
				}
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
