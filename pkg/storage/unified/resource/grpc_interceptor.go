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
// for unified-storage RPCs. Returns a pass-through if metrics is nil or RequestDuration
// is unset, so it is safe to apply unconditionally.
func UnaryRequestDurationInterceptor(metrics *StorageMetrics) grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
		if metrics == nil || metrics.RequestDuration == nil {
			return handler(ctx, req)
		}
		start := time.Now()
		resp, err := handler(ctx, req)
		group, resource := requestKeyLabels(req)
		metrics.RequestDuration.
			WithLabelValues(path.Base(info.FullMethod), group, resource, status.Code(err).String()).
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
	case *resourcepb.ResourceSearchRequest:
		key = r.GetOptions().GetKey()
	case *resourcepb.PutBlobRequest:
		key = r.GetResource()
	case *resourcepb.GetBlobRequest:
		key = r.GetResource()
	case *resourcepb.QuotaUsageRequest:
		key = r.GetKey()
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
