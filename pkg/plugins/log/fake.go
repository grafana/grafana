package log

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

func (f *TestLogger) New(_ ...interface{}) Logger {
	return NewTestLogger()
}

func (f *TestLogger) Info(msg string, ctx ...interface{}) {
	f.InfoLogs.Calls++
	f.InfoLogs.Message = msg
	f.InfoLogs.Ctx = ctx
}

func (f *TestLogger) Warn(msg string, ctx ...interface{}) {
	f.WarnLogs.Calls++
	f.WarnLogs.Message = msg
	f.WarnLogs.Ctx = ctx
}

func (f *TestLogger) Debug(msg string, ctx ...interface{}) {
	f.DebugLogs.Calls++
	f.DebugLogs.Message = msg
	f.DebugLogs.Ctx = ctx
}

func (f *TestLogger) Error(msg string, ctx ...interface{}) {
	f.ErrorLogs.Calls++
	f.ErrorLogs.Message = msg
	f.ErrorLogs.Ctx = ctx
}

type Logs struct {
	Calls   int
	Message string
	Ctx     []interface{}
}
