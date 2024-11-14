package log

import (
	"context"
	"sync"
)

var _ Logger = (*TestLogger)(nil)

type TestLogger struct {
	DebugLogs Logs
	InfoLogs  Logs
	WarnLogs  Logs
	ErrorLogs Logs
}

func NewTestLogger() *TestLogger {
	return &TestLogger{}
}

func (f *TestLogger) New(_ ...any) Logger {
	return NewTestLogger()
}

func (f *TestLogger) Info(msg string, ctx ...any) {
	f.InfoLogs.Call(msg, ctx)
}

func (f *TestLogger) Warn(msg string, ctx ...any) {
	f.WarnLogs.Call(msg, ctx)
}

func (f *TestLogger) Debug(msg string, ctx ...any) {
	f.DebugLogs.Call(msg, ctx)
}

func (f *TestLogger) Error(msg string, ctx ...any) {
	f.ErrorLogs.Call(msg, ctx)
}

func (f *TestLogger) FromContext(_ context.Context) Logger {
	return NewTestLogger()
}

type Logs struct {
	Calls   int
	Message string
	Ctx     []any

	mu sync.Mutex
}

func (l *Logs) Call(msg string, ctx ...any) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.Calls++
	l.Message = msg
	l.Ctx = ctx
}

var _ PrettyLogger = (*TestPrettyLogger)(nil)

type TestPrettyLogger struct{}

func NewTestPrettyLogger() *TestPrettyLogger {
	return &TestPrettyLogger{}
}

func (f *TestPrettyLogger) Successf(_ string, _ ...any) {}
func (f *TestPrettyLogger) Failuref(_ string, _ ...any) {}
func (f *TestPrettyLogger) Info(_ ...any)               {}
func (f *TestPrettyLogger) Infof(_ string, _ ...any)    {}
func (f *TestPrettyLogger) Debug(_ ...any)              {}
func (f *TestPrettyLogger) Debugf(_ string, _ ...any)   {}
func (f *TestPrettyLogger) Warn(_ ...any)               {}
func (f *TestPrettyLogger) Warnf(_ string, _ ...any)    {}
func (f *TestPrettyLogger) Error(_ ...any)              {}
func (f *TestPrettyLogger) Errorf(_ string, _ ...any)   {}
