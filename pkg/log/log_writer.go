package log

import (
	"io"
	"strings"
)

type logWriterImpl struct {
	log    Logger
	level  Lvl
	prefix string
}

func NewLogWriter(log Logger, level Lvl, prefix string) io.Writer {
	return &logWriterImpl{
		log:    log,
		level:  level,
		prefix: prefix,
	}
}

func (l *logWriterImpl) Write(p []byte) (n int, err error) {
	message := l.prefix + strings.TrimSpace(string(p))

	switch l.level {
	case LvlCrit:
		l.log.Crit(message)
	case LvlError:
		l.log.Error(message)
	case LvlWarn:
		l.log.Warn(message)
	case LvlInfo:
		l.log.Info(message)
	default:
		l.log.Debug(message)
	}

	return len(p), nil
}
