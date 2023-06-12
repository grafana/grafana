package errutil

import "context"

type LogLevel string

const (
	LevelUnknown LogLevel = ""
	LevelNever   LogLevel = "never"
	LevelDebug   LogLevel = "debug"
	LevelInfo    LogLevel = "info"
	LevelWarn    LogLevel = "warn"
	LevelError   LogLevel = "error"
)

// LogInterface is a subset of github.com/grafana/grafana/pkg/infra/log.Logger
// to avoid having to depend on other packages in the module so that
// there's no risk of circular dependencies.
type LogInterface interface {
	Debug(msg string, ctx ...interface{})
	Info(msg string, ctx ...interface{})
	Warn(msg string, ctx ...interface{})
	Error(msg string, ctx ...interface{})
}

func (l LogLevel) LogFunc(logger LogInterface) func(msg string, ctx ...interface{}) {
	switch l {
	case LevelNever:
		return func(_ string, _ ...interface{}) {}
	case LevelDebug:
		return logger.Debug
	case LevelInfo:
		return logger.Info
	case LevelWarn:
		return logger.Warn
	default: // LevelUnknown and LevelError.
		return logger.Error
	}
}

func (l LogLevel) HighestOf(other LogLevel) LogLevel {
	if l.order() < other.order() {
		return other
	}
	return l
}

func (l LogLevel) order() int {
	switch l {
	case LevelNever:
		return 0
	case LevelDebug:
		return 1
	case LevelInfo:
		return 2
	case LevelWarn:
		return 3
	default: // LevelUnknown and LevelError.
		return 4
	}
}

type useUnifiedLogging struct{}

func SetUnifiedLogging(ctx context.Context) context.Context {
	return context.WithValue(ctx, useUnifiedLogging{}, true)
}

func HasUnifiedLogging(ctx context.Context) bool {
	v, ok := ctx.Value(useUnifiedLogging{}).(bool)
	return ok && v
}
