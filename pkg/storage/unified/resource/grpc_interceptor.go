package resource

import (
	"context"
	"path"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// UnaryErrorResultInterceptor converts response-embedded errors into gRPC status
// errors while retaining the full ErrorResult as a status detail.
func UnaryErrorResultInterceptor() grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req any, _ *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
		resp, err := handler(ctx, req)
		if err != nil {
			return resp, err
		}
		result, ok := resp.(interface {
			GetError() *resourcepb.ErrorResult
		})
		if !ok || result.GetError() == nil {
			return resp, nil
		}
		failure := result.GetError()
		st, err := status.New(grpcCodeFromErrorResult(failure), failure.Message).WithDetails(failure)
		if err != nil {
			return nil, status.Error(codes.Internal, "failed to encode error details")
		}
		return nil, st.Err()
	}
}

const listPathNotApplicable = "not_applicable"

type requestMetricsState struct {
	listPath string
}

type requestMetricsStateKey struct{}

func withRequestMetricsState(ctx context.Context) (context.Context, *requestMetricsState) {
	state := &requestMetricsState{listPath: listPathNotApplicable}
	return context.WithValue(ctx, requestMetricsStateKey{}, state), state
}

func setListRequestPath(ctx context.Context, path string) {
	if state, ok := ctx.Value(requestMetricsStateKey{}).(*requestMetricsState); ok {
		state.listPath = path
	}
}

// UnaryRequestDurationInterceptor records storage_server_grpc_request_duration_seconds
// for unified-storage RPCs. A nil metrics records to unregistered collectors,
// so it is safe to apply unconditionally.
func UnaryRequestDurationInterceptor(metrics *StorageMetrics) grpc.UnaryServerInterceptor {
	if metrics == nil {
		metrics = ProvideStorageMetrics(nil)
	}
	return func(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
		start := time.Now()
		ctx, state := withRequestMetricsState(ctx)
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
			WithLabelValues(path.Base(info.FullMethod), group, resource, code.String(), state.listPath).
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
