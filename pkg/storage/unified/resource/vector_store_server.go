package resource

import (
	"context"
	"encoding/json"

	claims "github.com/grafana/authlib/types"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed/embedder"
	"github.com/grafana/grafana/pkg/storage/unified/search/vector"
)

// maxWriteBatch caps inputs per upsert and uids per delete. The proto
// documents the inputs cap; the uids cap is server-enforced symmetry.
const maxWriteBatch = 500

// maxMetadataBytes mirrors the proto contract (metadata ≤ 4 KiB JSON).
const maxMetadataBytes = 4096

// vectorWriteStore is the narrow slice of vector.VectorBackend the write
// service needs — handler tests fake these seven methods, not the whole
// backend interface.
type vectorWriteStore interface {
	ResolveCollection(ctx context.Context, group, resource string) (vector.Collection, bool, error)
	EnsureCollection(ctx context.Context, group, resource string, isExternal bool) (vector.Collection, error)
	Upsert(ctx context.Context, vectors []vector.Vector) error
	UpsertReplaceSubresources(ctx context.Context, namespace, model, resource, uid string, changed []vector.Vector, metadataOnly []vector.VectorMeta, desired []string) error
	GetSubresourceContent(ctx context.Context, namespace, model, resource, uid string) (map[string]string, string, error)
	DeleteRows(ctx context.Context, namespace, model, resource string, sel vector.DeleteSelector) (int64, bool, error)
	WithEntityLock(ctx context.Context, namespace, resource, uid string, fn func(context.Context) error) error
}

// VectorStoreServer implements resourcepb.VectorStoreServer: the write API
// for externally-pushed vector collections. Failures are gRPC status codes
// only — responses carry no ErrorResult.
type VectorStoreServer struct {
	store     vectorWriteStore
	embedder  *embedder.Embedder
	allowlist vector.CollectionAllowlist
	log       log.Logger
	metrics   *VectorMetrics
}

var _ resourcepb.VectorStoreServer = (*VectorStoreServer)(nil)

// NewVectorStoreServer builds the write service. externalAllowlist entries
// are "group/resource" pairs (vector_allowed_external_collections config);
// only allowlisted external collections are writable.
func NewVectorStoreServer(store vector.VectorBackend, emb *embedder.Embedder, externalAllowlist []string, metrics *VectorMetrics) *VectorStoreServer {
	return &VectorStoreServer{
		store:     store,
		embedder:  emb,
		allowlist: vector.NewCollectionAllowlist(nil, externalAllowlist),
		log:       log.New("vector-store-server"),
		metrics:   metrics,
	}
}

// authorize runs the common request prefix: key fields present, token
// namespace matches, collection allowlisted. Returns nil when the request
// may proceed to collection resolution.
func (s *VectorStoreServer) authorize(ctx context.Context, namespace, group, resource string) error {
	if namespace == "" || group == "" || resource == "" {
		return status.Error(codes.InvalidArgument, "namespace, group and resource are required")
	}
	user, ok := claims.AuthInfoFrom(ctx)
	if !ok || user == nil {
		return status.Error(codes.Unauthenticated, "no identity in context")
	}
	if !claims.NamespaceMatches(user.GetNamespace(), namespace) {
		return status.Error(codes.PermissionDenied, "namespace mismatch")
	}
	// Only external collections are writable through this API. Allowlist
	// misses and unprovisioned collections answer identically so callers
	// can't probe which collections exist.
	if !s.allowlist.Allows(vector.Collection{Group: group, Resource: resource, IsExternal: true}) {
		return status.Errorf(codes.NotFound, "collection %s/%s not found", group, resource)
	}
	return nil
}

// validateInputs enforces the per-input contract. When requireUID is
// non-empty (UpsertSubresources), every input's uid must be empty or equal
// to it.
func validateInputs(inputs []*resourcepb.EmbeddingInput, requireUID string) error {
	if len(inputs) == 0 {
		return status.Error(codes.InvalidArgument, "inputs must not be empty")
	}
	if len(inputs) > maxWriteBatch {
		return status.Errorf(codes.InvalidArgument, "too many inputs: %d > %d", len(inputs), maxWriteBatch)
	}
	for i, in := range inputs {
		switch {
		case in == nil:
			return status.Errorf(codes.InvalidArgument, "inputs[%d]: empty", i)
		case requireUID == "" && in.Uid == "":
			return status.Errorf(codes.InvalidArgument, "inputs[%d]: uid is required", i)
		case requireUID != "" && in.Uid != "" && in.Uid != requireUID:
			return status.Errorf(codes.InvalidArgument, "inputs[%d]: uid %q does not match request uid %q", i, in.Uid, requireUID)
		case in.Content == "":
			return status.Errorf(codes.InvalidArgument, "inputs[%d]: content is required", i)
		case in.Title == "":
			return status.Errorf(codes.InvalidArgument, "inputs[%d]: title is required", i)
		case len(in.Metadata) > maxMetadataBytes:
			return status.Errorf(codes.InvalidArgument, "inputs[%d]: metadata exceeds %d bytes", i, maxMetadataBytes)
		case len(in.Metadata) > 0 && !json.Valid(in.Metadata):
			return status.Errorf(codes.InvalidArgument, "inputs[%d]: metadata is not valid JSON", i)
		}
	}
	return nil
}

// embedInputs embeds every input's content (retrieval-document task) and
// returns one Vector per input, stamped with the collection's partition key.
// Embedding is all-or-nothing per batch: a provider failure fails the call.
func (s *VectorStoreServer) embedInputs(ctx context.Context, namespace string, coll vector.Collection, uid string, inputs []*resourcepb.EmbeddingInput) ([]vector.Vector, error) {
	texts := make([]string, len(inputs))
	for i, in := range inputs {
		texts[i] = in.Content
	}
	out, err := s.embedder.EmbedText(ctx, embedder.EmbedTextInput{
		Texts:     texts,
		Normalize: s.embedder.ShouldNormalize(),
		Task:      embedder.TaskRetrievalDocument,
		Tenant:    namespace,
	})
	if err != nil {
		s.log.Error("vector store: embed batch", "err", err, "group", coll.Group, "resource", coll.Resource)
		return nil, status.Error(codes.Internal, "embed batch")
	}
	if len(out.Embeddings) != len(inputs) {
		return nil, status.Errorf(codes.Internal, "embedder returned %d embeddings for %d inputs", len(out.Embeddings), len(inputs))
	}
	rows := make([]vector.Vector, len(inputs))
	for i, in := range inputs {
		rowUID := in.Uid
		if rowUID == "" {
			rowUID = uid
		}
		rows[i] = vector.Vector{
			Namespace:   namespace,
			Resource:    coll.PartitionKey,
			UID:         rowUID,
			Title:       in.Title,
			Subresource: in.Subresource,
			Content:     in.Content,
			Metadata:    in.Metadata,
			Embedding:   out.Embeddings[i].Dense,
			Model:       s.embedder.Model,
		}
	}
	return rows, nil
}

func (s *VectorStoreServer) Upsert(ctx context.Context, req *resourcepb.VectorUpsertRequest) (*resourcepb.VectorUpsertResponse, error) {
	if err := s.authorize(ctx, req.Namespace, req.Group, req.Resource); err != nil {
		return nil, err
	}
	if err := validateInputs(req.Inputs, ""); err != nil {
		return nil, err
	}

	coll, err := s.store.EnsureCollection(ctx, req.Group, req.Resource, true)
	if err != nil {
		s.log.Error("vector store: ensure collection", "err", err, "group", req.Group, "resource", req.Resource)
		return nil, status.Error(codes.Internal, "provision collection")
	}

	rows, err := s.embedInputs(ctx, req.Namespace, coll, "", req.Inputs)
	if err != nil {
		return nil, err
	}
	if err := s.store.Upsert(ctx, rows); err != nil {
		s.log.Error("vector store: upsert", "err", err, "group", req.Group, "resource", req.Resource)
		return nil, status.Error(codes.Internal, "upsert")
	}
	return &resourcepb.VectorUpsertResponse{Upserted: int64(len(rows))}, nil
}

func (s *VectorStoreServer) UpsertSubresources(ctx context.Context, req *resourcepb.VectorUpsertSubresourcesRequest) (*resourcepb.VectorUpsertSubresourcesResponse, error) {
	if err := s.authorize(ctx, req.Namespace, req.Group, req.Resource); err != nil {
		return nil, err
	}
	return nil, status.Error(codes.Unimplemented, "not implemented yet")
}

func (s *VectorStoreServer) Delete(ctx context.Context, req *resourcepb.VectorDeleteRequest) (*resourcepb.VectorDeleteResponse, error) {
	if err := s.authorize(ctx, req.Namespace, req.Group, req.Resource); err != nil {
		return nil, err
	}
	return nil, status.Error(codes.Unimplemented, "not implemented yet")
}

// UpdateMetadata ships in PR2 with the metadata filter dialect.
func (s *VectorStoreServer) UpdateMetadata(ctx context.Context, req *resourcepb.VectorUpdateMetadataRequest) (*resourcepb.VectorUpdateMetadataResponse, error) {
	if err := s.authorize(ctx, req.Namespace, req.Group, req.Resource); err != nil {
		return nil, err
	}
	return nil, status.Error(codes.Unimplemented, "UpdateMetadata ships with the metadata filter dialect")
}
