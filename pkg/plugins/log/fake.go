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

var _ PrettyLogger = (*TestPrettyLogger)(nil)

type TestPrettyLogger struct{}

func NewTestPrettyLogger() *TestPrettyLogger {
	return &TestPrettyLogger{}
}

func (f *TestPrettyLogger) Successf(_ string, _ ...interface{}) {}
func (f *TestPrettyLogger) Failuref(_ string, _ ...interface{}) {}
func (f *TestPrettyLogger) Info(_ ...interface{})               {}
func (f *TestPrettyLogger) Infof(_ string, _ ...interface{})    {}
func (f *TestPrettyLogger) Debug(_ ...interface{})              {}
func (f *TestPrettyLogger) Debugf(_ string, _ ...interface{})   {}
func (f *TestPrettyLogger) Warn(_ ...interface{})               {}
func (f *TestPrettyLogger) Warnf(_ string, _ ...interface{})    {}
func (f *TestPrettyLogger) Error(_ ...interface{})              {}
func (f *TestPrettyLogger) Errorf(_ string, _ ...interface{})   {}
