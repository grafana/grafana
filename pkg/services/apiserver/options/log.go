package options

import (
	"strings"

	"github.com/go-logr/logr"

	"github.com/grafana/grafana/pkg/infra/log"
)

var _ logr.LogSink = (*logAdapter)(nil)

type logAdapter struct {
	level int
	log   log.Logger
}

func newLogAdapter(level int) *logAdapter {
	return &logAdapter{log: log.New("grafana-apiserver"), level: level}
}

func (l *logAdapter) WithName(name string) logr.LogSink {
	l.log = l.log.New("name", name)
	return l
}

func (l *logAdapter) WithValues(keysAndValues ...any) logr.LogSink {
	l.log = l.log.New(keysAndValues...)
	return l
}

func (l *logAdapter) Init(_ logr.RuntimeInfo) {
	// we aren't using the logr library for logging, so this is a no-op
}

func (l *logAdapter) Enabled(level int) bool {
	return level <= l.level
}

func (l *logAdapter) Info(level int, msg string, keysAndValues ...any) {
	msg = strings.TrimSpace(msg)
	// kubernetes uses level 0 for critical messages, so map that to Info
	if level == 0 {
		l.log.Info(msg, keysAndValues...)
		return
	}
	// every other level is mapped to Debug
	l.log.Debug(msg, keysAndValues...)
}

func (l *logAdapter) Error(err error, msg string, keysAndValues ...any) {
	msg = strings.TrimSpace(msg)
	l.log.Error(msg, keysAndValues...)
}
