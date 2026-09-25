package resource

import (
	"context"
	"path"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// UnaryRequestDurationInterceptor records storage_server_grpc_request_duration_seconds
// for unified-storage RPCs. A nil metrics records to unregistered collectors,
// so it is safe to apply unconditionally.
func UnaryRequestDurationInterceptor(metrics *StorageMetrics) grpc.UnaryServerInterceptor {
	if metrics == nil {
		metrics = ProvideStorageMetrics(nil)
	}
	return func(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
		start := time.Now()
		resp, err := handler(ctx, req)
		group, resource := requestKeyLabels(req)
		code := status.Code(err)
		if err == nil {
			if result, ok := resp.(interface {
				GetError() *resourcepb.ErrorResult
			}); ok {
				code = grpcCodeFromErrorResult(result.GetError())
			}
		}
		metrics.RequestDuration.
			WithLabelValues(path.Base(info.FullMethod), group, resource, code.String()).
			Observe(time.Since(start).Seconds())
		return resp, err
	}
}

func requestKeyLabels(req any) (group, resource string) {
	group, resource = "unknown", "unknown"
	var key *resourcepb.ResourceKey
	switch r := req.(type) {
	case *resourcepb.CreateRequest:
		key = r.GetKey()
	case *resourcepb.UpdateRequest:
		key = r.GetKey()
	case *resourcepb.DeleteRequest:
		key = r.GetKey()
	case *resourcepb.ReadRequest:
		key = r.GetKey()
	case *resourcepb.ListRequest:
		key = r.GetOptions().GetKey()
	}
	if key != nil {
		if g := key.GetGroup(); g != "" {
			group = g
		}
		if rr := key.GetResource(); rr != "" {
			resource = rr
		}
	}
	return
}
