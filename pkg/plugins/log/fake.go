package log

var _ Logger = (*FakeLogger)(nil)

type FakeLogger struct {
	DebugLogs Logs
	InfoLogs  Logs
	WarnLogs  Logs
	ErrorLogs Logs
}

func NewTestLogger() *FakeLogger {
	return &FakeLogger{}
}

func NewNopLogger() Logger {
	return NewTestLogger()
}

func (f FakeLogger) New(_ ...interface{}) Logger {
	return NewTestLogger()
}

func (f FakeLogger) Info(msg string, ctx ...interface{}) {
	f.InfoLogs.Calls++
	f.InfoLogs.Message = msg
	f.InfoLogs.Ctx = ctx
}

func (f FakeLogger) Warn(msg string, ctx ...interface{}) {
	f.WarnLogs.Calls++
	f.WarnLogs.Message = msg
	f.WarnLogs.Ctx = ctx
}

func (f FakeLogger) Debug(msg string, ctx ...interface{}) {
	f.DebugLogs.Calls++
	f.DebugLogs.Message = msg
	f.DebugLogs.Ctx = ctx
}

func (f FakeLogger) Error(msg string, ctx ...interface{}) {
	f.ErrorLogs.Calls++
	f.ErrorLogs.Message = msg
	f.ErrorLogs.Ctx = ctx
}

type Logs struct {
	Calls   int
	Message string
	Ctx     []interface{}
}
