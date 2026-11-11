package resource

import (
	"context"
	"sync"

	"github.com/grafana/grafana-app-sdk/logging"
)

type fakeLogs struct {
	Calls   int
	Message string
	Args    []any
}

// fakeLogger records the last call per level. Loggers derived with With share
// the parent's records so assertions see logs from every child.
type fakeLogger struct {
	mu        *sync.Mutex
	args      []any
	DebugLogs *fakeLogs
	InfoLogs  *fakeLogs
	WarnLogs  *fakeLogs
	ErrorLogs *fakeLogs
}

var _ logging.Logger = (*fakeLogger)(nil)

func newFakeLogger() *fakeLogger {
	return &fakeLogger{
		mu:        &sync.Mutex{},
		DebugLogs: &fakeLogs{},
		InfoLogs:  &fakeLogs{},
		WarnLogs:  &fakeLogs{},
		ErrorLogs: &fakeLogs{},
	}
}

func (f *fakeLogger) record(l *fakeLogs, msg string, args []any) {
	f.mu.Lock()
	defer f.mu.Unlock()
	l.Calls++
	l.Message = msg
	l.Args = append(append([]any{}, f.args...), args...)
}

func (f *fakeLogger) Debug(msg string, args ...any) { f.record(f.DebugLogs, msg, args) }
func (f *fakeLogger) Info(msg string, args ...any)  { f.record(f.InfoLogs, msg, args) }
func (f *fakeLogger) Warn(msg string, args ...any)  { f.record(f.WarnLogs, msg, args) }
func (f *fakeLogger) Error(msg string, args ...any) { f.record(f.ErrorLogs, msg, args) }

func (f *fakeLogger) With(args ...any) logging.Logger {
	child := *f
	child.args = append(append([]any{}, f.args...), args...)
	return &child
}

func (f *fakeLogger) WithContext(context.Context) logging.Logger { return f }
