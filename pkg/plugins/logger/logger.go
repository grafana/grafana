package logger

import "context"

// New is...
func New(_ ...interface{}) Logger {
	return &DefaultLogger{}
}

type DefaultLogger struct{}

func (d DefaultLogger) New(ctx ...interface{}) Logger {
	return d
}

func (d DefaultLogger) Log(keyvals ...interface{}) error {
	return nil
}

func (d DefaultLogger) Debug(msg string, ctx ...interface{}) {
}

func (d DefaultLogger) Info(msg string, ctx ...interface{}) {
}

func (d DefaultLogger) Warn(msg string, ctx ...interface{}) {
}

func (d DefaultLogger) Error(msg string, ctx ...interface{}) {
}

func (d DefaultLogger) FromContext(ctx context.Context) Logger {
	return d
}

// NewNopLogger is...
func NewNopLogger() Logger {
	return &DefaultLogger{} //TODO
}

// NewTestLogger is...
func NewTestLogger() *TestLogger {
	return &TestLogger{}
}

type TestLogger struct {
	DebugLogs Logs
	InfoLogs  Logs
	WarnLogs  Logs
	ErrorLogs Logs
}

func (t TestLogger) New(_ ...interface{}) Logger {
	return NewNopLogger()
}

func (t TestLogger) Log(_ ...interface{}) error {
	return nil
}

func (t TestLogger) Info(msg string, ctx ...interface{}) {
	t.InfoLogs.Calls++
	t.InfoLogs.Message = msg
	t.InfoLogs.Ctx = ctx
}

func (t TestLogger) Warn(msg string, ctx ...interface{}) {
	t.WarnLogs.Calls++
	t.WarnLogs.Message = msg
	t.WarnLogs.Ctx = ctx
}

func (t TestLogger) Debug(msg string, ctx ...interface{}) {
	t.DebugLogs.Calls++
	t.DebugLogs.Message = msg
	t.DebugLogs.Ctx = ctx
}

func (t TestLogger) Error(msg string, ctx ...interface{}) {
	t.ErrorLogs.Calls++
	t.ErrorLogs.Message = msg
	t.ErrorLogs.Ctx = ctx
}

func (t TestLogger) FromContext(_ context.Context) Logger {
	return NewNopLogger()
}

type Logs struct {
	Calls   int
	Message string
	Ctx     []interface{}
}

var _ Logger = (*TestLogger)(nil)
