package interceptors

import (
	"context"
	"fmt"

	"github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/logging"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"

	"github.com/grafana/grafana/pkg/infra/log"
)

func InterceptorLogger(l log.Logger, enabled bool) logging.Logger {
	return logging.LoggerFunc(func(ctx context.Context, lvl logging.Level, msg string, fields ...any) {
		if !enabled {
			return
		}
		l := l.FromContext(ctx)
		switch lvl {
		case logging.LevelDebug:
			l.Debug(msg, fields...)
		case logging.LevelInfo:
			l.Info(msg, fields...)
		case logging.LevelWarn:
			l.Warn(msg, fields...)
		case logging.LevelError:
			l.Error(msg, fields...)
		default:
			panic(fmt.Sprintf("unknown level %v", lvl))
		}
	})
}

// serverCodeToLevel logs HTTP 4xx statuses sent as gRPC codes (the httpgrpc
// convention) as warnings, like the gRPC client-error codes, instead of the
// error level the default gives unknown codes.
func serverCodeToLevel(code codes.Code) logging.Level {
	if code >= 400 && code < 500 {
		return logging.LevelWarn
	}
	return logging.DefaultServerCodeToLevel(code)
}

func LoggingUnaryInterceptor(logger log.Logger, enabled bool) grpc.UnaryServerInterceptor {
	return logging.UnaryServerInterceptor(InterceptorLogger(logger, enabled), logging.WithLevels(serverCodeToLevel))
}

func LoggingStreamInterceptor(logger log.Logger, enabled bool) grpc.StreamServerInterceptor {
	return logging.StreamServerInterceptor(InterceptorLogger(logger, enabled), logging.WithLevels(serverCodeToLevel))
}
