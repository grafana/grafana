package interceptors

import (
	"context"
	"fmt"
	"runtime/debug"

	"github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/recovery"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/infra/log"
)

var recoveryLogger = log.New("grpc-server-recovery")

// recoveryHandler logs the recovered panic with a stack trace and returns a
// generic Internal status. The panic value is not included in the error sent
// to the client to avoid leaking internal details.
func recoveryHandler(ctx context.Context, p any) error {
	recoveryLogger.FromContext(ctx).Error(
		"recovered from panic in gRPC handler",
		"panic", fmt.Sprintf("%v", p),
		"stack", string(debug.Stack()),
	)
	return status.Errorf(codes.Internal, "internal server error")
}

// UnaryPanicRecoveryInterceptor returns a unary server interceptor that
// recovers from panics in gRPC handlers. Without it, an unrecovered panic in
// any handler goroutine crashes the entire process (gRPC has no built-in
// handler-level panic recovery).
func UnaryPanicRecoveryInterceptor() grpc.UnaryServerInterceptor {
	return recovery.UnaryServerInterceptor(recovery.WithRecoveryHandlerContext(recoveryHandler))
}

// StreamPanicRecoveryInterceptor is the streaming counterpart of
// UnaryPanicRecoveryInterceptor.
func StreamPanicRecoveryInterceptor() grpc.StreamServerInterceptor {
	return recovery.StreamServerInterceptor(recovery.WithRecoveryHandlerContext(recoveryHandler))
}
