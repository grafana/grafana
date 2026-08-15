package resource

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"
	"unicode/utf8"

	authnlib "github.com/grafana/authlib/authn"
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

// maxKeyFieldLen mirrors the VARCHAR(256) width of the uid and subresource
// columns — reject before spending an embedding on a row Postgres will bounce.
const maxKeyFieldLen = 256

// vectorWriteStore is the narrow slice of vector.VectorBackend the write
// service needs.
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
	store           vectorWriteStore
	embedder        *embedder.Embedder
	allowlist       vector.CollectionAllowlist
	allowedServices map[string]struct{}
	log             log.Logger
	metrics         *VectorMetrics
}

var _ resourcepb.VectorStoreServer = (*VectorStoreServer)(nil)

// NewVectorStoreServer builds the write service. externalAllowlist entries
// are "group/resource" pairs (vector_allowed_external_collections config);
// only allowlisted external collections are writable. allowedServices are
// the service identities permitted to write (vector_allowed_write_services
// config); empty means no identity restriction. Per-collection ownership is
// a planned follow-up.
func NewVectorStoreServer(store vector.VectorBackend, emb *embedder.Embedder, externalAllowlist, allowedServices []string, metrics *VectorMetrics) *VectorStoreServer {
	services := make(map[string]struct{}, len(allowedServices))
	for _, s := range allowedServices {
		// A stray comma in the config must not admit identity-less tokens.
		if s != "" {
			services[s] = struct{}{}
		}
	}
	return &VectorStoreServer{
		store:           store,
		embedder:        emb,
		allowlist:       vector.NewCollectionAllowlist(nil, externalAllowlist),
		allowedServices: services,
		log:             log.New("vector-store-server"),
		metrics:         metrics,
	}
}

// observe records one RPC observation. Wrap in defer at the top of each
// handler: defer s.observe("upsert", time.Now(), &retErr).
func (s *VectorStoreServer) observe(rpc string, start time.Time, errp *error) {
	if s.metrics == nil {
		return
	}
	code := codes.OK
	if errp != nil && *errp != nil {
		code = status.Code(*errp)
	}
	s.metrics.WriteDuration.WithLabelValues(rpc, code.String()).Observe(time.Since(start).Seconds())
}

// countRows adds written/deleted rows for one collection.
func (s *VectorStoreServer) countRows(rpc, group, resource string, n int64) {
	if s.metrics == nil || n == 0 {
		return
	}
	s.metrics.WriteRowsTotal.WithLabelValues(rpc, group, resource).Add(float64(n))
}

// writeStatusError maps a downstream failure to its gRPC status: the
// caller's dead context wins (Canceled/DeadlineExceeded), anything else is
// Internal. Mirrors the VectorSearch convention.
func writeStatusError(ctx context.Context, err error, msg string) error {
	switch ctx.Err() {
	case context.Canceled:
		return status.Error(codes.Canceled, msg)
	case context.DeadlineExceeded:
		return status.Error(codes.DeadlineExceeded, msg)
	}
	// A downstream error that already carries an explicitly retryable gRPC
	// code (e.g. the embedding provider's quota pressure or transient
	// outage) keeps that code so client retry policies work as documented.
	if err != nil {
		if s, ok := status.FromError(err); ok && (s.Code() == codes.ResourceExhausted || s.Code() == codes.Unavailable) {
			return status.Error(s.Code(), msg)
		}
	}
	return status.Error(codes.Internal, msg)
}

// ensureExternalCollection provisions/returns the collection, mapping a kind
// mismatch (catalog says internal) to the same NotFound as an allowlist miss
// so callers can't distinguish internal collections from absent ones.
func (s *VectorStoreServer) ensureExternalCollection(ctx context.Context, group, resource string) (vector.Collection, error) {
	coll, err := s.store.EnsureCollection(ctx, group, resource, true)
	if err != nil {
		if errors.Is(err, vector.ErrCollectionKindMismatch) {
			return vector.Collection{}, status.Errorf(codes.NotFound, "collection %s/%s not found", group, resource)
		}
		s.log.Error("vector store: ensure collection", "err", err, "group", group, "resource", resource)
		return vector.Collection{}, writeStatusError(ctx, err, "provision collection")
	}
	return coll, nil
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
	if len(s.allowedServices) > 0 {
		svc := ""
		if ids := user.GetExtra()[authnlib.ServiceIdentityKey]; len(ids) > 0 {
			svc = ids[0]
		}
		if _, ok := s.allowedServices[svc]; !ok {
			return status.Error(codes.PermissionDenied, "service identity not allowed to write vectors")
		}
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
		case utf8.RuneCountInString(in.Uid) > maxKeyFieldLen:
			return status.Errorf(codes.InvalidArgument, "inputs[%d]: uid exceeds %d chars", i, maxKeyFieldLen)
		case utf8.RuneCountInString(in.Subresource) > maxKeyFieldLen:
			return status.Errorf(codes.InvalidArgument, "inputs[%d]: subresource exceeds %d chars", i, maxKeyFieldLen)
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
		return nil, writeStatusError(ctx, err, "embed batch")
	}
	if len(out.Embeddings) != len(inputs) {
		return nil, writeStatusError(ctx, nil, fmt.Sprintf("embedder returned %d embeddings for %d inputs", len(out.Embeddings), len(inputs)))
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

func (s *VectorStoreServer) Upsert(ctx context.Context, req *resourcepb.VectorUpsertRequest) (resp *resourcepb.VectorUpsertResponse, retErr error) {
	defer s.observe("upsert", time.Now(), &retErr)

	if err := s.authorize(ctx, req.Namespace, req.Group, req.Resource); err != nil {
		return nil, err
	}
	if err := validateInputs(req.Inputs, ""); err != nil {
		return nil, err
	}

	coll, err := s.ensureExternalCollection(ctx, req.Group, req.Resource)
	if err != nil {
		return nil, err
	}

	rows, err := s.embedInputs(ctx, req.Namespace, coll, "", req.Inputs)
	if err != nil {
		return nil, err
	}
	if err := s.store.Upsert(ctx, rows); err != nil {
		s.log.Error("vector store: upsert", "err", err, "group", req.Group, "resource", req.Resource)
		return nil, writeStatusError(ctx, err, "upsert")
	}
	s.countRows("upsert", req.Group, req.Resource, int64(len(rows)))
	return &resourcepb.VectorUpsertResponse{Upserted: int64(len(rows))}, nil
}

func (s *VectorStoreServer) UpsertSubresources(ctx context.Context, req *resourcepb.VectorUpsertSubresourcesRequest) (resp *resourcepb.VectorUpsertSubresourcesResponse, retErr error) {
	defer s.observe("upsert_subresources", time.Now(), &retErr)

	if err := s.authorize(ctx, req.Namespace, req.Group, req.Resource); err != nil {
		return nil, err
	}
	if req.Uid == "" {
		return nil, status.Error(codes.InvalidArgument, "uid is required")
	}
	if utf8.RuneCountInString(req.Uid) > maxKeyFieldLen {
		return nil, status.Errorf(codes.InvalidArgument, "uid exceeds %d chars", maxKeyFieldLen)
	}
	if err := validateInputs(req.Inputs, req.Uid); err != nil {
		return nil, err
	}
	seen := make(map[string]struct{}, len(req.Inputs))
	for i, in := range req.Inputs {
		if _, dup := seen[in.Subresource]; dup {
			return nil, status.Errorf(codes.InvalidArgument, "inputs[%d]: duplicate subresource %q", i, in.Subresource)
		}
		seen[in.Subresource] = struct{}{}
	}

	coll, err := s.ensureExternalCollection(ctx, req.Group, req.Resource)
	if err != nil {
		return nil, err
	}

	resp = &resourcepb.VectorUpsertSubresourcesResponse{}
	err = s.store.WithEntityLock(ctx, req.Namespace, coll.PartitionKey, req.Uid, func(ctx context.Context) error {
		stored, _, err := s.store.GetSubresourceContent(ctx, req.Namespace, s.embedder.Model, coll.PartitionKey, req.Uid)
		if err != nil {
			return writeStatusError(ctx, err, "read stored subresources")
		}

		desired := make([]string, 0, len(req.Inputs))
		toEmbed := make([]*resourcepb.EmbeddingInput, 0, len(req.Inputs))
		metadataOnly := make([]vector.VectorMeta, 0, len(req.Inputs))
		present := make(map[string]struct{}, len(req.Inputs))
		for _, in := range req.Inputs {
			desired = append(desired, in.Subresource)
			prev, ok := stored[in.Subresource]
			if ok {
				present[in.Subresource] = struct{}{}
			}
			switch {
			case !ok:
				resp.Created++
				toEmbed = append(toEmbed, in)
			case prev != in.Content:
				resp.Updated++
				toEmbed = append(toEmbed, in)
			default:
				// Content unchanged: title/metadata still refresh so sync
				// markers stay current without re-embed cost.
				metadataOnly = append(metadataOnly, vector.VectorMeta{
					Subresource: in.Subresource,
					Title:       in.Title,
					Metadata:    in.Metadata,
				})
			}
		}
		resp.Deleted = int64(len(stored) - len(present))

		var changed []vector.Vector
		if len(toEmbed) > 0 {
			changed, err = s.embedInputs(ctx, req.Namespace, coll, req.Uid, toEmbed)
			if err != nil {
				return err // already a status error
			}
		}
		if err := s.store.UpsertReplaceSubresources(ctx, req.Namespace, s.embedder.Model, coll.PartitionKey, req.Uid, changed, metadataOnly, desired); err != nil {
			s.log.Error("vector store: replace subresources", "err", err, "group", req.Group, "resource", req.Resource, "uid", req.Uid)
			return writeStatusError(ctx, err, "replace subresources")
		}
		return nil
	})
	if err != nil {
		if _, ok := status.FromError(err); ok {
			return nil, err
		}
		return nil, writeStatusError(ctx, err, "entity lock")
	}
	s.countRows("upsert_subresources", req.Group, req.Resource, resp.Created+resp.Updated+resp.Deleted)
	return resp, nil
}

// deleteAllPageSize is one Delete(delete_all) page, per the proto contract.
const deleteAllPageSize = 10000

func (s *VectorStoreServer) Delete(ctx context.Context, req *resourcepb.VectorDeleteRequest) (resp *resourcepb.VectorDeleteResponse, retErr error) {
	defer s.observe("delete", time.Now(), &retErr)

	if err := s.authorize(ctx, req.Namespace, req.Group, req.Resource); err != nil {
		return nil, err
	}

	// Deletes never provision: an unknown collection is NOT_FOUND, and
	// callers treat delete-NOT_FOUND as benign.
	coll, found, err := s.store.ResolveCollection(ctx, req.Group, req.Resource)
	if err != nil {
		s.log.Error("vector store: resolve collection", "err", err, "group", req.Group, "resource", req.Resource)
		return nil, writeStatusError(ctx, err, "resolve collection")
	}
	if !found || !coll.IsExternal {
		return nil, status.Errorf(codes.NotFound, "collection %s/%s not found", req.Group, req.Resource)
	}

	// External collections have no backfill, so rows embedded under a prior
	// model would be unreachable orphans — delete across all models.
	sel := vector.DeleteSelector{AllModels: true}
	switch sl := req.Selector.(type) {
	case *resourcepb.VectorDeleteRequest_Uids:
		uids := sl.Uids.GetValues()
		if len(uids) == 0 {
			return nil, status.Error(codes.InvalidArgument, "uids must not be empty")
		}
		if len(uids) > maxWriteBatch {
			return nil, status.Errorf(codes.InvalidArgument, "too many uids: %d > %d", len(uids), maxWriteBatch)
		}
		sel.UIDs = uids
	case *resourcepb.VectorDeleteRequest_DeleteAll:
		if !sl.DeleteAll {
			return nil, status.Error(codes.InvalidArgument, "delete_all must be true when set")
		}
		sel.All = true
		sel.Limit = deleteAllPageSize
	case *resourcepb.VectorDeleteRequest_Filter:
		return nil, status.Error(codes.Unimplemented, "filter deletes ship with the metadata filter dialect")
	default:
		return nil, status.Error(codes.InvalidArgument, "a selector is required")
	}

	deleted, hasMore, err := s.store.DeleteRows(ctx, req.Namespace, s.embedder.Model, coll.PartitionKey, sel)
	if err != nil {
		s.log.Error("vector store: delete rows", "err", err, "group", req.Group, "resource", req.Resource)
		return nil, writeStatusError(ctx, err, "delete rows")
	}
	s.countRows("delete", req.Group, req.Resource, deleted)
	return &resourcepb.VectorDeleteResponse{Deleted: deleted, HasMore: hasMore}, nil
}

// UpdateMetadata ships with the metadata filter dialect.
func (s *VectorStoreServer) UpdateMetadata(ctx context.Context, req *resourcepb.VectorUpdateMetadataRequest) (resp *resourcepb.VectorUpdateMetadataResponse, retErr error) {
	defer s.observe("update_metadata", time.Now(), &retErr)

	if err := s.authorize(ctx, req.Namespace, req.Group, req.Resource); err != nil {
		return nil, err
	}
	return nil, status.Error(codes.Unimplemented, "UpdateMetadata ships with the metadata filter dialect")
}
