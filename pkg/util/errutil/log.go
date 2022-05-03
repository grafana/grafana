package errutil

type LogLevel string

const (
	LevelUnknown LogLevel = ""
	LevelNever   LogLevel = "never"
	LevelDebug   LogLevel = "debug"
	LevelInfo    LogLevel = "info"
	LevelWarn    LogLevel = "warn"
	LevelError   LogLevel = "error"
)

// LogInterface is a subset of github.com/grafana/grafana/
type LogInterface interface {
	Debug(msg string, ctx ...interface{})
	Info(msg string, ctx ...interface{})
	Warn(msg string, ctx ...interface{})
	Error(msg string, ctx ...interface{})
}

func (l LogLevel) LogFunc(logger LogInterface) func(msg string, ctx ...interface{}) {
	switch l {
	case LevelDebug:
		return logger.Debug
	case LevelInfo:
		return logger.Info
	case LevelWarn:
		return logger.Warn
	case LevelError:
		return logger.Error
	default:
		return func(_ string, _ ...interface{}) {}
	}
}
