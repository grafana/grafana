package resource

import (
	"context"
	"errors"
	"fmt"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// resourceKVServer implements resourcepb.ResourceKVServer by delegating to a
// ResourceKVStore. All key-prefix construction happens in the store; this
// server is a thin request→store→response adapter.
//
// Authentication: every RPC requires an authenticated identity extracted from
// the gRPC context by the shared auth interceptor. Fine-grained authz (owner
// scoping, write-permission checks) is deferred to the API layer.
//
// Toggle: when store is nil the toggle is off; all RPCs return Unimplemented
// so callers can distinguish "feature disabled" from other errors.
type resourceKVServer struct {
	store *kv.ResourceKVStore
}

var _ resourcepb.ResourceKVServer = (*resourceKVServer)(nil)

// NewResourceKVServer creates a ResourceKV gRPC server backed by the given
// store. Pass nil to get a server that returns Unimplemented on every call
// (feature-toggle-off path).
func NewResourceKVServer(store *kv.ResourceKVStore) resourcepb.ResourceKVServer {
	return &resourceKVServer{store: store}
}

// requireStore returns an Unimplemented error when the store is nil.
func (s *resourceKVServer) requireStore() error {
	if s.store == nil {
		return status.Error(codes.Unimplemented, "storage.resourceKV feature toggle is off")
	}
	return nil
}

// requireIdentity returns an Unauthenticated error when there is no verified
// identity in the context. The auth interceptor populates the identity; this
// check is a defence-in-depth guard in case the RPC reaches the handler
// without going through the interceptor.
func requireIdentity(ctx context.Context) error {
	if _, ok := claims.AuthInfoFrom(ctx); !ok {
		return status.Error(codes.Unauthenticated, "no authenticated identity in context")
	}
	return nil
}

// mapStoreError converts ResourceKVStore errors to gRPC status errors.
// Error→code mapping:
//   - ErrInvalidKey     → InvalidArgument  (malformed owner/key violates the API contract)
//   - ErrValueTooLarge  → InvalidArgument  (value exceeds the fixed 64 KiB per-entry limit;
//     this is a caller contract violation, not a server quota, so InvalidArgument fits
//     better than ResourceExhausted which implies a variable server-side capacity limit)
//   - ErrNotFound       → NotFound
//   - ErrKeyAlreadyExists → AlreadyExists  (surfaces from Batch Create ops)
//   - BatchError wrapping either of the above → their respective codes
//   - too-many-ops error from Batch → InvalidArgument
//   - anything else     → Internal
func mapStoreError(op string, err error) error {
	if err == nil {
		return nil
	}
	// BatchError carries the underlying constraint error; unwrap it first.
	var batchErr *kv.BatchError
	if errors.As(err, &batchErr) {
		err = batchErr.Err
	}
	switch {
	case errors.Is(err, kv.ErrInvalidKey), errors.Is(err, kv.ErrTooManyOps):
		return status.Errorf(codes.InvalidArgument, "%s: %v", op, err)
	case errors.Is(err, kv.ErrValueTooLarge):
		return status.Errorf(codes.InvalidArgument, "%s: %v", op, err)
	case errors.Is(err, kv.ErrNotFound):
		return status.Errorf(codes.NotFound, "%s: key not found", op)
	case errors.Is(err, kv.ErrKeyAlreadyExists):
		return status.Errorf(codes.AlreadyExists, "%s: key already exists", op)
	default:
		return status.Errorf(codes.Internal, "%s: %v", op, err)
	}
}

func parentFromProto(rk *resourcepb.ResourceKey) kv.ResourceParent {
	return kv.ResourceParent{
		Group:     rk.GetGroup(),
		Resource:  rk.GetResource(),
		Namespace: rk.GetNamespace(),
		Name:      rk.GetName(),
	}
}

func protoModeToKV(mode resourcepb.ResourceKVBatchOp_Mode) (kv.BatchOpMode, error) {
	switch mode {
	case resourcepb.ResourceKVBatchOp_PUT:
		return kv.BatchOpPut, nil
	case resourcepb.ResourceKVBatchOp_CREATE:
		return kv.BatchOpCreate, nil
	case resourcepb.ResourceKVBatchOp_UPDATE:
		return kv.BatchOpUpdate, nil
	case resourcepb.ResourceKVBatchOp_DELETE:
		return kv.BatchOpDelete, nil
	default:
		return 0, fmt.Errorf("unknown batch op mode %v", mode)
	}
}

func (s *resourceKVServer) Get(ctx context.Context, req *resourcepb.ResourceKVGetRequest) (*resourcepb.ResourceKVGetResponse, error) {
	if err := s.requireStore(); err != nil {
		return nil, err
	}
	if err := requireIdentity(ctx); err != nil {
		return nil, err
	}
	if req.GetParent() == nil {
		return nil, status.Error(codes.InvalidArgument, "parent is required")
	}
	p := parentFromProto(req.GetParent())
	value, updatedAt, updatedBy, err := s.store.Get(ctx, p, req.GetOwner(), req.GetKey())
	if err != nil {
		return nil, mapStoreError("get kv", err)
	}
	return &resourcepb.ResourceKVGetResponse{
		Value:     value,
		UpdatedAt: updatedAt,
		UpdatedBy: updatedBy,
	}, nil
}

func (s *resourceKVServer) Save(ctx context.Context, req *resourcepb.ResourceKVSaveRequest) (*resourcepb.ResourceKVSaveResponse, error) {
	if err := s.requireStore(); err != nil {
		return nil, err
	}
	if err := requireIdentity(ctx); err != nil {
		return nil, err
	}
	if req.GetParent() == nil {
		return nil, status.Error(codes.InvalidArgument, "parent is required")
	}
	p := parentFromProto(req.GetParent())
	if err := s.store.Save(ctx, p, req.GetOwner(), req.GetKey(), req.GetValue(), req.GetBy()); err != nil {
		return nil, mapStoreError("save kv", err)
	}
	return &resourcepb.ResourceKVSaveResponse{}, nil
}

func (s *resourceKVServer) Delete(ctx context.Context, req *resourcepb.ResourceKVDeleteRequest) (*resourcepb.ResourceKVDeleteResponse, error) {
	if err := s.requireStore(); err != nil {
		return nil, err
	}
	if err := requireIdentity(ctx); err != nil {
		return nil, err
	}
	if req.GetParent() == nil {
		return nil, status.Error(codes.InvalidArgument, "parent is required")
	}
	p := parentFromProto(req.GetParent())
	if err := s.store.Delete(ctx, p, req.GetOwner(), req.GetKey()); err != nil {
		return nil, mapStoreError("delete kv", err)
	}
	return &resourcepb.ResourceKVDeleteResponse{}, nil
}

func (s *resourceKVServer) Keys(ctx context.Context, req *resourcepb.ResourceKVKeysRequest) (*resourcepb.ResourceKVKeysResponse, error) {
	if err := s.requireStore(); err != nil {
		return nil, err
	}
	if err := requireIdentity(ctx); err != nil {
		return nil, err
	}
	if req.GetParent() == nil {
		return nil, status.Error(codes.InvalidArgument, "parent is required")
	}
	p := parentFromProto(req.GetParent())

	var keys []string
	var err error

	if owner := req.GetOwner(); owner != "" {
		// Narrowed scan: return bare key names within the owner's prefix.
		keys, err = s.store.KeysByOwner(ctx, p, owner)
	} else {
		keys, err = s.store.Keys(ctx, p, kv.ListOptions{
			StartKey: req.GetStartKey(),
			Limit:    req.GetLimit(),
		})
	}
	if err != nil {
		return nil, mapStoreError("keys kv", err)
	}
	return &resourcepb.ResourceKVKeysResponse{Keys: keys}, nil
}

func (s *resourceKVServer) Batch(ctx context.Context, req *resourcepb.ResourceKVBatchRequest) (*resourcepb.ResourceKVBatchResponse, error) {
	if err := s.requireStore(); err != nil {
		return nil, err
	}
	if err := requireIdentity(ctx); err != nil {
		return nil, err
	}
	if req.GetParent() == nil {
		return nil, status.Error(codes.InvalidArgument, "parent is required")
	}
	p := parentFromProto(req.GetParent())

	ops := make([]kv.ResourceKVBatchOp, 0, len(req.GetOps()))
	for _, op := range req.GetOps() {
		mode, err := protoModeToKV(op.GetMode())
		if err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid batch op mode: %v", err)
		}
		ops = append(ops, kv.ResourceKVBatchOp{
			Mode:  mode,
			Owner: op.GetOwner(),
			Key:   op.GetKey(),
			Value: op.GetValue(),
			By:    op.GetBy(),
		})
	}

	if err := s.store.Batch(ctx, p, ops); err != nil {
		return nil, mapStoreError("batch kv", err)
	}
	return &resourcepb.ResourceKVBatchResponse{}, nil
}

func (s *resourceKVServer) ScanNamespace(req *resourcepb.ResourceKVScanRequest, stream resourcepb.ResourceKV_ScanNamespaceServer) error {
	if err := s.requireStore(); err != nil {
		return err
	}
	if err := requireIdentity(stream.Context()); err != nil {
		return err
	}
	items, err := s.store.ScanNamespace(stream.Context(), req.GetGroup(), req.GetResource(), req.GetNamespace())
	if err != nil {
		return status.Errorf(codes.Internal, "scan namespace: %v", err)
	}
	for _, item := range items {
		if err := stream.Send(&resourcepb.ResourceKVScanResponse{
			Name:  item.Name,
			Owner: item.Owner,
			Key:   item.Key,
			Value: item.Value,
		}); err != nil {
			return err
		}
	}
	return nil
}

func (s *resourceKVServer) DeleteAllForName(ctx context.Context, req *resourcepb.ResourceKVDeleteAllForNameRequest) (*resourcepb.ResourceKVDeleteAllForNameResponse, error) {
	if err := s.requireStore(); err != nil {
		return nil, err
	}
	if err := requireIdentity(ctx); err != nil {
		return nil, err
	}
	if req.GetGroup() == "" || req.GetResource() == "" || req.GetNamespace() == "" || req.GetName() == "" {
		return nil, status.Error(codes.InvalidArgument, "group, resource, namespace and name are required")
	}
	if err := s.store.DeleteAllForName(ctx, req.GetGroup(), req.GetResource(), req.GetNamespace(), req.GetName()); err != nil {
		return nil, status.Errorf(codes.Internal, "delete all for name: %v", err)
	}
	return &resourcepb.ResourceKVDeleteAllForNameResponse{}, nil
}
