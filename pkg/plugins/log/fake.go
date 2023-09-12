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

func (f *TestLogger) New(_ ...any) Logger {
	return NewTestLogger()
}

func (f *TestLogger) Info(msg string, ctx ...any) {
	f.InfoLogs.Calls++
	f.InfoLogs.Message = msg
	f.InfoLogs.Ctx = ctx
}

func (f *TestLogger) Warn(msg string, ctx ...any) {
	f.WarnLogs.Calls++
	f.WarnLogs.Message = msg
	f.WarnLogs.Ctx = ctx
}

func (f *TestLogger) Debug(msg string, ctx ...any) {
	f.DebugLogs.Calls++
	f.DebugLogs.Message = msg
	f.DebugLogs.Ctx = ctx
}

func (f *TestLogger) Error(msg string, ctx ...any) {
	f.ErrorLogs.Calls++
	f.ErrorLogs.Message = msg
	f.ErrorLogs.Ctx = ctx
}

type Logs struct {
	Calls   int
	Message string
	Ctx     []any
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
