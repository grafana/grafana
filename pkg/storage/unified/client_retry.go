package unified

import (
	"context"
	"strconv"
	"time"

	grpc_retry "github.com/grpc-ecosystem/go-grpc-middleware/retry"
	"github.com/grpc-ecosystem/go-grpc-middleware/util/metautils"
	"github.com/prometheus/client_golang/prometheus"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
)

type retryConfig struct {
	Max           uint
	Backoff       time.Duration
	BackoffJitter float64
}

// unaryRetryInterceptor creates an interceptor to perform retries for unary methods.
//
// Note: Retry codes are the same as the default codes.
//
//	From go-grpc-middleware/interceptors/retry/options.go:
//	`ResourceExhausted` means that the user quota, e.g. per-RPC limits, have been reached.
//	`Unavailable` means that system is currently unavailable and the client should retry again.
func unaryRetryInterceptor(cfg retryConfig) grpc.UnaryClientInterceptor {
	return grpc_retry.UnaryClientInterceptor(
		grpc_retry.WithMax(cfg.Max),
		grpc_retry.WithBackoff(grpc_retry.BackoffExponentialWithJitter(cfg.Backoff, cfg.BackoffJitter)),
		grpc_retry.WithCodes(codes.ResourceExhausted, codes.Unavailable),
	)
}

// unaryRetryInstrument creates an interceptor to count and log retry attempts.
func unaryRetryInstrument(metric *prometheus.CounterVec) grpc.UnaryClientInterceptor {
	return func(ctx context.Context, method string, req, resp interface{}, cc *grpc.ClientConn, invoker grpc.UnaryInvoker, opts ...grpc.CallOption) error {
		// We can tell if a call is a retry by checking the retry attempt metadata.
		attempt, err := strconv.Atoi(metautils.ExtractOutgoing(ctx).Get(grpc_retry.AttemptMetadataKey))
		if err == nil && attempt > 0 {
			metric.WithLabelValues(method).Inc()
		}
		return invoker(ctx, method, req, resp, cc, opts...)
	}
}
