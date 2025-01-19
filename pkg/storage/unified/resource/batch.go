package resource

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"

	"google.golang.org/grpc/metadata"

	"github.com/grafana/authlib/claims"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

const grpcMetaKeyCollection = "x-gf-batch-collection"
const grpcMetaKeyRebuildCollection = "x-gf-batch-rebuild-collection"
const grpcMetaKeySkipValidation = "x-gf-batch-skip-validation"

func grpcMetaValueIsTrue(vals []string) bool {
	return len(vals) == 1 && vals[0] == "true"
}

type BatchProcessingBackend interface {
	ProcessBatch(ctx context.Context, setting BatchSettings, next func() *BatchRequest) (*BatchResponse, error)
}

type BatchSettings struct {
	// All requests will be within this namespace/group/resource
	Collection []*ResourceKey

	// The batch will include everything from the collection
	// - all existing values will be removed/replaced if the batch completes successfully
	RebuildCollection bool

	// The byte[] payload and folder has already been validated - no need to decode and verify
	SkipValidation bool
}

func (x *BatchSettings) ToMD() metadata.MD {
	md := make(metadata.MD)
	if len(x.Collection) > 0 {
		for _, v := range x.Collection {
			md[grpcMetaKeyCollection] = append(md[grpcMetaKeyCollection], v.SearchID())
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

func NewBatchSettings(md metadata.MD) (BatchSettings, error) {
	settings := BatchSettings{}
	for k, v := range md {
		switch k {
		case grpcMetaKeyCollection:
			for _, c := range v {
				key := &ResourceKey{}
				err := key.ReadSearchID(c)
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

// BatchWrite implements ResourceServer.
// All requests must be to the same NAMESPACE/GROUP/RESOURCE
func (s *server) BatchProcess(stream ResourceStore_BatchProcessServer) error {
	backend, ok := s.backend.(BatchProcessingBackend)
	if !ok {
		return fmt.Errorf("backend does not support batched requests")
	}

	ctx := stream.Context()
	user, ok := claims.From(ctx)
	if !ok || user == nil {
		return stream.SendAndClose(&BatchResponse{
			Error: &ErrorResult{
				Message: "no user found in context",
				Code:    http.StatusUnauthorized,
			},
		})
	}

	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return stream.SendAndClose(&BatchResponse{
			Error: &ErrorResult{
				Message: "unable to read metadata gRPC request",
				Code:    http.StatusPreconditionFailed,
			},
		})
	}
	settings, err := NewBatchSettings(md)
	if err != nil {
		return stream.SendAndClose(&BatchResponse{
			Error: &ErrorResult{
				Message: "error reading settings",
				Reason:  err.Error(),
				Code:    http.StatusPreconditionFailed,
			},
		})
	}

	if len(settings.Collection) < 1 {
		return stream.SendAndClose(&BatchResponse{
			Error: &ErrorResult{
				Message: "Missing target collection(s) in request header",
				Code:    http.StatusBadRequest,
			},
		})
	}

	if settings.RebuildCollection {
		for _, k := range settings.Collection {
			fmt.Printf("TODO> check access... can %s: %s\n", utils.VerbDeleteCollection, k.SearchID())
			fmt.Printf("TODO> check access... can %s: %s\n", utils.VerbCreate, k.SearchID())
		}
	} else {
		return stream.SendAndClose(&BatchResponse{
			Error: &ErrorResult{
				Message: "Batch currently only supports RebuildCollection",
				Code:    http.StatusBadRequest,
			},
		})
	}

	// BatchProcess requests
	rsp, err := backend.ProcessBatch(ctx, settings, func() *BatchRequest {
		req, err := stream.Recv()
		if errors.Is(err, io.EOF) {
			return nil
		}
		if err != nil {
			return nil
		}
		return req
	})
	if rsp == nil {
		rsp = &BatchResponse{}
	}
	if err == nil {
		// Rebuild the index for this key
		for _, key := range settings.Collection {
			started := time.Now()
			idx, rv, err := s.search.build(ctx, NamespacedResource{
				Namespace: key.Namespace,
				Group:     key.Group,
				Resource:  key.Resource,
			}, rsp.Processed, time.Now().UnixMilli()) // can we get the RV from the MAX(RV) in ns/g/r
			if err != nil {
				return err // should not happen
			}
			count, err := idx.DocCount(ctx, "")
			if err != nil {
				return err // should not happen
			}
			elapsed := time.Since(started)
			fmt.Printf("Index: %s / size:%d / rv:%d / elapsed: %s\n", key.Resource, count, rv, elapsed.String())
		}
	}

	if err != nil {
		rsp.Error = AsErrorResult(err)
	}

	fmt.Printf("Finished (core)\n")
	return stream.SendAndClose(rsp)
}
