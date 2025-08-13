package pq

import (
	"context"
	"encoding/hex"
	"fmt"
	errors "golang.org/x/xerrors"
	"log"
	"os"
	"strings"
)

// The values for log levels are chosen such that the zero value means that no
// log level was specified.
const (
	LogLevelTrace = 6
	LogLevelDebug = 5
	LogLevelInfo  = 4
	LogLevelWarn  = 3
	LogLevelError = 2
	LogLevelNone  = 1
)

// LogLevel represents the conn logging level. See LogLevel* constants for
// possible values.
type LogLevel int

func (ll LogLevel) String() string {
	switch ll {
	case LogLevelTrace:
		return "trace"
	case LogLevelDebug:
		return "debug"
	case LogLevelInfo:
		return "info"
	case LogLevelWarn:
		return "warn"
	case LogLevelError:
		return "error"
	case LogLevelNone:
		return "none"
	default:
		return fmt.Sprintf("invalid level %d", ll)
	}
}

// Logger is the interface used to get logging from conn internals.
type Logger interface {
	// Log a message at the given level with data key/value pairs. data may be nil.
	Log(ctx context.Context, level LogLevel, msg string, data map[string]interface{})
}

// LogLevelFromString converts log level string to constant
//
// Valid levels:
//	trace
//	debug
//	info
//	warn
//	error
//	none
func LogLevelFromString(s string) (LogLevel, error) {
	switch s {
	case "trace":
		return LogLevelTrace, nil
	case "debug":
		return LogLevelDebug, nil
	case "info":
		return LogLevelInfo, nil
	case "warn":
		return LogLevelWarn, nil
	case "error":
		return LogLevelError, nil
	case "none":
		return LogLevelNone, nil
	default:
		return 0, errors.New("invalid log level")
	}
}

func logQueryArgs(args []interface{}) []interface{} {
	logArgs := make([]interface{}, 0, len(args))

	for _, a := range args {
		switch v := a.(type) {
		case []byte:
			if len(v) < 64 {
				a = hex.EncodeToString(v)
			} else {
				a = fmt.Sprintf("%x (truncated %d bytes)", v[:64], len(v)-64)
			}
		case string:
			if len(v) > 64 {
				a = fmt.Sprintf("%s (truncated %d bytes)", v[:64], len(v)-64)
			}
		}
		logArgs = append(logArgs, a)
	}

	return logArgs
}

var DefaultLogger Logger = NewPrintfLogger(LogLevelDebug)

type printfLogger struct {
	l     *log.Logger
	level LogLevel
}

func (l *printfLogger) Log(ctx context.Context, level LogLevel, msg string, data map[string]interface{}) {

	if !(l.l != nil && l.level >= level) {
		return
	}
	logArgs := make([]interface{}, 0, len(data))
	for k, v := range data {
		logArgs = append(logArgs, k, v)
	}

	msg = "%5s " + msg + " " + formatString(len(logArgs))

	_ = l.l.Output(3, fmt.Sprintf(msg, append([]interface{}{level}, logArgs...)...))
}
func formatString(numKeysAndValues int) string {
	var sb strings.Builder
	for i := 0; i < numKeysAndValues; i++ {
		sb.WriteString("%v ")
	}
	return sb.String()
}
func NewPrintfLogger(level LogLevel) Logger {
	l := &printfLogger{
		l:     log.New(os.Stdout, "", log.LstdFlags|log.Lmicroseconds|log.Lshortfile),
		level: level,
	}
	return l
}
