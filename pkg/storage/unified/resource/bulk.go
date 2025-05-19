package resource

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"

	"google.golang.org/grpc/metadata"

	authlib "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

const grpcMetaKeyCollection = "x-gf-batch-collection"
const grpcMetaKeyRebuildCollection = "x-gf-batch-rebuild-collection"
const grpcMetaKeySkipValidation = "x-gf-batch-skip-validation"

func grpcMetaValueIsTrue(vals []string) bool {
	return len(vals) == 1 && vals[0] == "true"
}

type BulkRequestIterator interface {
	Next() bool

	// The next event we should process
	Request() *resourcepb.BulkRequest

	// Rollback requested
	RollbackRequested() bool
}

type BulkProcessingBackend interface {
	ProcessBulk(ctx context.Context, setting BulkSettings, iter BulkRequestIterator) *resourcepb.BulkResponse
}

type BulkResourceWriter interface {
	io.Closer

	Write(ctx context.Context, key *resourcepb.ResourceKey, value []byte) error

	// Called when finished writing
	CloseWithResults() (*resourcepb.BulkResponse, error)
}

type BulkSettings struct {
	// All requests will be within this namespace/group/resource
	Collection []*resourcepb.ResourceKey

	// The batch will include everything from the collection
	// - all existing values will be removed/replaced if the batch completes successfully
	RebuildCollection bool

	// The byte[] payload and folder has already been validated - no need to decode and verify
	SkipValidation bool
}

func (x *BulkSettings) ToMD() metadata.MD {
	md := make(metadata.MD)
	if len(x.Collection) > 0 {
		for _, v := range x.Collection {
			md[grpcMetaKeyCollection] = append(md[grpcMetaKeyCollection], SearchID(v))
		}
	}
	if x.RebuildCollection {
		md[grpcMetaKeyRebuildCollection] = []string{"true"}
	}
	if x.SkipValidation {
		md[grpcMetaKeySkipValidation] = []string{"true"}
	}
	return md
}

func NewBulkSettings(md metadata.MD) (BulkSettings, error) {
	settings := BulkSettings{}
	for k, v := range md {
		switch k {
		case grpcMetaKeyCollection:
			for _, c := range v {
				key := &resourcepb.ResourceKey{}
				err := ReadSearchID(key, c)
				if err != nil {
					return settings, fmt.Errorf("error reading collection metadata: %s / %w", c, err)
				}
				settings.Collection = append(settings.Collection, key)
			}
		case grpcMetaKeyRebuildCollection:
			settings.RebuildCollection = grpcMetaValueIsTrue(v)
		case grpcMetaKeySkipValidation:
			settings.SkipValidation = grpcMetaValueIsTrue(v)
		}
	}
	return settings, nil
}

// BulkWrite implements ResourceServer.
// All requests must be to the same NAMESPACE/GROUP/RESOURCE
func (s *server) BulkProcess(stream resourcepb.BulkStore_BulkProcessServer) error {
	ctx := stream.Context()
	user, ok := authlib.AuthInfoFrom(ctx)
	if !ok || user == nil {
		return stream.SendAndClose(&resourcepb.BulkResponse{
			Error: &resourcepb.ErrorResult{
				Message: "no user found in context",
				Code:    http.StatusUnauthorized,
			},
		})
	}

	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return stream.SendAndClose(&resourcepb.BulkResponse{
			Error: &resourcepb.ErrorResult{
				Message: "unable to read metadata gRPC request",
				Code:    http.StatusPreconditionFailed,
			},
		})
	}
	runner := &batchRunner{
		checker: make(map[string]authlib.ItemChecker), // Can create
		stream:  stream,
	}
	settings, err := NewBulkSettings(md)
	if err != nil {
		return stream.SendAndClose(&resourcepb.BulkResponse{
			Error: &resourcepb.ErrorResult{
				Message: "error reading settings",
				Reason:  err.Error(),
				Code:    http.StatusPreconditionFailed,
			},
		})
	}

	if len(settings.Collection) < 1 {
		return stream.SendAndClose(&resourcepb.BulkResponse{
			Error: &resourcepb.ErrorResult{
				Message: "Missing target collection(s) in request header",
				Code:    http.StatusBadRequest,
			},
		})
	}

	if settings.RebuildCollection {
		for _, k := range settings.Collection {
			// Can we delete the whole collection
			rsp, err := s.access.Check(ctx, user, authlib.CheckRequest{
				Namespace: k.Namespace,
				Group:     k.Group,
				Resource:  k.Resource,
				Verb:      utils.VerbDeleteCollection,
			})
			if err != nil || !rsp.Allowed {
				return stream.SendAndClose(&resourcepb.BulkResponse{
					Error: &resourcepb.ErrorResult{
						Message: fmt.Sprintf("Requester must be able to: %s", utils.VerbDeleteCollection),
						Code:    http.StatusForbidden,
					},
				})
			}

			// This will be called for each request -- with the folder ID
			runner.checker[NSGR(k)], err = s.access.Compile(ctx, user, authlib.ListRequest{
				Namespace: k.Namespace,
				Group:     k.Group,
				Resource:  k.Resource,
				Verb:      utils.VerbCreate,
			})
			if err != nil {
				return stream.SendAndClose(&resourcepb.BulkResponse{
					Error: &resourcepb.ErrorResult{
						Message: "Unable to check `create` permission",
						Code:    http.StatusForbidden,
					},
				})
			}
		}
	} else {
		return stream.SendAndClose(&resourcepb.BulkResponse{
			Error: &resourcepb.ErrorResult{
				Message: "Bulk currently only supports RebuildCollection",
				Code:    http.StatusBadRequest,
			},
		})
	}

	backend, ok := s.backend.(BulkProcessingBackend)
	if !ok {
		return stream.SendAndClose(&resourcepb.BulkResponse{
			Error: &resourcepb.ErrorResult{
				Message: "The server backend does not support batch processing",
				Code:    http.StatusNotImplemented,
			},
		})
	}

	// BulkProcess requests
	rsp := backend.ProcessBulk(ctx, settings, runner)
	if rsp == nil {
		rsp = &resourcepb.BulkResponse{
			Error: &resourcepb.ErrorResult{
				Code:    http.StatusInternalServerError,
				Message: "Nothing returned from process batch",
			},
		}
	}
	if runner.err != nil {
		rsp.Error = AsErrorResult(runner.err)
	}

	if rsp.Error == nil && s.search != nil {
		// Rebuild any changed indexes
		for _, summary := range rsp.Summary {
			_, _, err := s.search.build(ctx, NamespacedResource{
				Namespace: summary.Namespace,
				Group:     summary.Group,
				Resource:  summary.Resource,
			}, summary.Count, summary.ResourceVersion)
			if err != nil {
				s.log.Warn("error building search index after batch load", "err", err)
				rsp.Error = &resourcepb.ErrorResult{
					Code:    http.StatusInternalServerError,
					Message: "err building search index: " + summary.Resource,
					Reason:  err.Error(),
				}
			}
		}
	}
	return stream.SendAndClose(rsp)
}

var (
	_ BulkRequestIterator = (*batchRunner)(nil)
)

type batchRunner struct {
	stream   resourcepb.BulkStore_BulkProcessServer
	rollback bool
	request  *resourcepb.BulkRequest
	err      error
	checker  map[string]authlib.ItemChecker
}

// Next implements BulkRequestIterator.
func (b *batchRunner) Next() bool {
	if b.rollback {
		return true
	}

	b.request, b.err = b.stream.Recv()
	if errors.Is(b.err, io.EOF) {
		b.err = nil
		b.rollback = false
		b.request = nil
		return false
	}

	if b.err != nil {
		b.rollback = true
		return true
	}

	if b.request != nil {
		key := b.request.Key
		k := NSGR(key)
		checker, ok := b.checker[k]
		if !ok {
			b.err = fmt.Errorf("missing access control for: %s", k)
			b.rollback = true
		} else if !checker(key.Name, b.request.Folder) {
			b.err = fmt.Errorf("not allowed to create resource")
			b.rollback = true
		}
		return true
	}
	return false
}

// Request implements BulkRequestIterator.
func (b *batchRunner) Request() *resourcepb.BulkRequest {
	if b.rollback {
		return nil
	}
	return b.request
}

// RollbackRequested implements BulkRequestIterator.
func (b *batchRunner) RollbackRequested() bool {
	if b.rollback {
		b.rollback = false // break iterator
		return true
	}
	return false
}
