// Copyright 2014 The Gogs Authors. All rights reserved.
// Use of this source code is governed by a MIT-style
// license that can be found in the LICENSE file.

package log

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	gokitlog "github.com/go-kit/log"
	"github.com/go-kit/log/level"
	"github.com/go-stack/stack"
	"github.com/mattn/go-isatty"
	sloggokit "github.com/tjhop/slog-gokit"
	"gopkg.in/ini.v1"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/infra/log/term"
	"github.com/grafana/grafana/pkg/infra/log/text"
	"github.com/grafana/grafana/pkg/util"
)

var (
	loggersToClose  []DisposableHandler
	loggersToReload []ReloadableHandler
	root            *logManager
	now             = time.Now
	logTimeFormat   = time.RFC3339Nano
	ctxLogProviders = []ContextualLogProviderFunc{}
)

const (
	// top 7 calls in the stack are within logger
	DefaultCallerDepth = 7
	CallerContextKey   = "caller"
)

func init() {
	loggersToClose = make([]DisposableHandler, 0)
	loggersToReload = make([]ReloadableHandler, 0)

	// Use discard by default
	format := func(w io.Writer) gokitlog.Logger {
		return gokitlog.NewLogfmtLogger(gokitlog.NewSyncWriter(io.Discard))
	}
	logger := level.NewFilter(format(os.Stderr), level.AllowInfo())
	root = newManager(logger)
	initAppSDKLogger(logger)

	RegisterContextualLogProvider(func(ctx context.Context) ([]any, bool) {
		pFromCtx := ctx.Value(logParamsContextKey{})
		if pFromCtx != nil {
			return pFromCtx.([]any), true
		}
		return nil, false
	})
}

// logManager manage loggers
type logManager struct {
	*ConcreteLogger
	loggersByName map[string]*ConcreteLogger
	logFilters    []logWithFilters
	mutex         sync.RWMutex
}

func newManager(logger gokitlog.Logger) *logManager {
	return &logManager{
		ConcreteLogger: newConcreteLogger(logger),
		loggersByName:  map[string]*ConcreteLogger{},
	}
}

func (lm *logManager) initialize(loggers []logWithFilters) {
	lm.mutex.Lock()
	defer lm.mutex.Unlock()

	defaultLoggers := make([]gokitlog.Logger, len(loggers))
	for index, logger := range loggers {
		defaultLoggers[index] = level.NewFilter(logger.val, logger.maxLevel)
	}

	lm.ConcreteLogger.Swap(&compositeLogger{loggers: defaultLoggers})
	lm.logFilters = loggers

	loggersByName := []string{}
	for k := range lm.loggersByName {
		loggersByName = append(loggersByName, k)
	}
	sort.Strings(loggersByName)

	for _, name := range loggersByName {
		ctxLoggers := make([]gokitlog.Logger, len(loggers))

		for index, logger := range loggers {
			ctxLogger := gokitlog.With(logger.val, lm.loggersByName[name].ctx...)
			if filterLevel, exists := logger.filters[name]; !exists {
				ctxLoggers[index] = level.NewFilter(ctxLogger, logger.maxLevel)
			} else {
				ctxLoggers[index] = level.NewFilter(ctxLogger, filterLevel)
			}
		}

		lm.loggersByName[name].Swap(&compositeLogger{loggers: ctxLoggers})
	}

	initAppSDKLogger(lm.ConcreteLogger)
}

func (lm *logManager) New(ctx ...any) *ConcreteLogger {
	// First key-value could be "logger" and a logger name, that would be handled differently
	// to allow per-logger filtering. Otherwise a simple concrete logger is returned.
	if len(ctx) < 2 {
		return lm.ConcreteLogger
	}
	if ctx[0] != "logger" {
		return newConcreteLogger(lm.ConcreteLogger, ctx...)
	}

	lm.mutex.Lock()
	defer lm.mutex.Unlock()

	// Logger name could be a string variable or an slog.Value()
	loggerName := ""
	switch v := ctx[1].(type) {
	case string:
		loggerName = v
	case slog.Value:
		loggerName = v.String()
	default:
		return lm.ConcreteLogger
	}

	if logger, exists := lm.loggersByName[loggerName]; exists {
		return logger
	}

	if len(lm.logFilters) == 0 {
		ctxLogger := newConcreteLogger(&lm.SwapLogger, ctx...)
		lm.loggersByName[loggerName] = ctxLogger
		return ctxLogger
	}

	compositeLogger := newCompositeLogger()
	for _, logWithFilter := range lm.logFilters {
		filterLevel, ok := logWithFilter.filters[loggerName]
		if ok {
			logWithFilter.val = level.NewFilter(logWithFilter.val, filterLevel)
		} else {
			logWithFilter.val = level.NewFilter(logWithFilter.val, logWithFilter.maxLevel)
		}

		compositeLogger.loggers = append(compositeLogger.loggers, logWithFilter.val)
	}

	ctxLogger := newConcreteLogger(compositeLogger, ctx...)
	lm.loggersByName[loggerName] = ctxLogger
	return ctxLogger
}

type ConcreteLogger struct {
	ctx []any
	gokitlog.SwapLogger
}

func newConcreteLogger(logger gokitlog.Logger, ctx ...any) *ConcreteLogger {
	var swapLogger gokitlog.SwapLogger

	if len(ctx) == 0 {
		ctx = []any{}
		swapLogger.Swap(logger)
	} else {
		swapLogger.Swap(gokitlog.With(logger, ctx...))
	}

	return &ConcreteLogger{
		ctx:        ctx,
		SwapLogger: swapLogger,
	}
}

func (cl ConcreteLogger) GetLogger() gokitlog.Logger {
	return &cl.SwapLogger
}

func (cl *ConcreteLogger) Warn(msg string, args ...any) {
	_ = cl.log(msg, level.WarnValue(), args...)
}

func (cl *ConcreteLogger) Debug(msg string, args ...any) {
	_ = cl.log(msg, level.DebugValue(), args...)
}

func (cl *ConcreteLogger) Log(ctx ...any) error {
	logger := gokitlog.With(&cl.SwapLogger, "t", gokitlog.TimestampFormat(now, logTimeFormat))
	return logger.Log(ctx...)
}

func (cl *ConcreteLogger) Error(msg string, args ...any) {
	_ = cl.log(msg, level.ErrorValue(), args...)
}

func (cl *ConcreteLogger) Info(msg string, args ...any) {
	_ = cl.log(msg, level.InfoValue(), args...)
}

func (cl *ConcreteLogger) log(msg string, logLevel level.Value, args ...any) error {
	return cl.Log(append([]any{level.Key(), logLevel, "msg", msg}, args...)...)
}

func FromContext(ctx context.Context) []any {
	args := []any{}
	for _, p := range ctxLogProviders {
		if pArgs, exists := p(ctx); exists {
			args = append(args, pArgs...)
		}
	}
	return args
}

func (cl *ConcreteLogger) FromContext(ctx context.Context) Logger {
	args := FromContext(ctx)
	if len(args) > 0 {
		return cl.New(args...)
	}
	return cl
}

func (cl *ConcreteLogger) New(ctx ...any) *ConcreteLogger {
	if len(cl.ctx) == 0 {
		return root.New(ctx...)
	}

	return newConcreteLogger(gokitlog.With(&cl.SwapLogger), ctx...)
}

// New creates a new logger.
// First ctx argument is expected to be the name of the logger.
// Note: For a contextual logger, i.e. a logger with a shared
// name plus additional contextual information, you must use the
// Logger interface New method for it to work as expected.
// Example creating a shared logger:
//
//	requestLogger := log.New("request-logger")
//
// Example creating a contextual logger:
//
//	contextualLogger := requestLogger.New("username", "user123")
func New(ctx ...any) *ConcreteLogger {
	if len(ctx) == 0 {
		return root.New()
	}

	ctx = append([]any{"logger"}, ctx...)
	return root.New(ctx...)
}

// NewNopLogger returns a logger that doesn't do anything.
func NewNopLogger() *ConcreteLogger {
	return newConcreteLogger(gokitlog.NewNopLogger())
}

func with(ctxLogger *ConcreteLogger, withFunc func(gokitlog.Logger, ...any) gokitlog.Logger, ctx []any) *ConcreteLogger {
	if len(ctx) == 0 {
		return ctxLogger
	}

	ctxLogger.Swap(withFunc(ctxLogger.GetLogger(), ctx...))
	return ctxLogger
}

// WithPrefix adds context that will be added to the log message
func WithPrefix(ctxLogger *ConcreteLogger, ctx ...any) *ConcreteLogger {
	return with(ctxLogger, gokitlog.WithPrefix, ctx)
}

// WithSuffix adds context that will be appended at the end of the log message
func WithSuffix(ctxLogger *ConcreteLogger, ctx ...any) *ConcreteLogger {
	return with(ctxLogger, gokitlog.WithSuffix, ctx)
}

// ContextualLogProviderFunc contextual log provider function definition.
type ContextualLogProviderFunc func(ctx context.Context) ([]any, bool)

// RegisterContextualLogProvider registers a ContextualLogProviderFunc
// that will be used to provide context when Logger.FromContext is called.
func RegisterContextualLogProvider(mw ContextualLogProviderFunc) {
	ctxLogProviders = append(ctxLogProviders, mw)
}

type logParamsContextKey struct{}

// WithContextualAttributes adds contextual attributes to the logger based on the given context.
// That allows loggers further down the chain to automatically log those attributes.
func WithContextualAttributes(ctx context.Context, logParams []any) context.Context {
	p := logParams
	if ctx.Value(logParamsContextKey{}) != nil {
		p = append(ctx.Value(logParamsContextKey{}).([]any), logParams...)
	}
	return context.WithValue(ctx, logParamsContextKey{}, p)
}

var logLevels = map[string]level.Option{
	"trace":    level.AllowDebug(),
	"debug":    level.AllowDebug(),
	"info":     level.AllowInfo(),
	"warn":     level.AllowWarn(),
	"error":    level.AllowError(),
	"critical": level.AllowError(),
}

func getLogLevelFromConfig(key string, defaultName string, cfg *ini.File) (string, level.Option) {
	levelName := cfg.Section(key).Key("level").MustString(defaultName)
	levelName = strings.ToLower(levelName)
	level := getLogLevelFromString(levelName)
	return levelName, level
}

func getLogLevelFromString(levelName string) level.Option {
	loglevel, ok := logLevels[levelName]

	if !ok {
		_ = level.Error(root).Log("Unknown log level", "level", levelName)
		return level.AllowError()
	}

	return loglevel
}

// the filter is composed with logger name and level
func getFilters(filterStrArray []string) map[string]level.Option {
	filterMap := make(map[string]level.Option)

	for i := 0; i < len(filterStrArray); i++ {
		filterStr := strings.TrimSpace(filterStrArray[i])

		if strings.HasPrefix(filterStr, ";") || strings.HasPrefix(filterStr, "#") {
			if len(filterStr) == 1 {
				i++
			}
			continue
		}

		parts := strings.Split(filterStr, ":")
		if len(parts) > 1 {
			filterMap[parts[0]] = getLogLevelFromString(parts[1])
		}
	}

	return filterMap
}

func Stack(skip int) string {
	call := stack.Caller(skip)
	s := stack.Trace().TrimBelow(call).TrimRuntime()
	return s.String()
}

// StackCaller returns a go-kit Valuer function that returns the stack trace from the place it is called. Argument `skip` allows skipping top n lines from the stack.
func StackCaller(skip int) gokitlog.Valuer {
	return func() any {
		return Stack(skip + 1)
	}
}

// Caller proxies go-kit/log Caller and returns a Valuer function that returns a file and line from a specified depth
// in the callstack
func Caller(depth int) gokitlog.Valuer {
	return gokitlog.Caller(depth)
}

type Formatedlogger func(w io.Writer) gokitlog.Logger

func getLogFormat(format string) Formatedlogger {
	switch format {
	case "console":
		if isatty.IsTerminal(os.Stdout.Fd()) {
			return func(w io.Writer) gokitlog.Logger {
				return term.NewTerminalLogger(w)
			}
		}
		return func(w io.Writer) gokitlog.Logger {
			return text.NewTextLogger(w)
		}
	case "text":
		return func(w io.Writer) gokitlog.Logger {
			return text.NewTextLogger(w)
		}
	case "json":
		return func(w io.Writer) gokitlog.Logger {
			return gokitlog.NewJSONLogger(gokitlog.NewSyncWriter(w))
		}
	default:
		return func(w io.Writer) gokitlog.Logger {
			return text.NewTextLogger(w)
		}
	}
}

// this is for file logger only
func Close() error {
	var err error
	for _, logger := range loggersToClose {
		if e := logger.Close(); e != nil && err == nil {
			err = e
		}
	}
	loggersToClose = make([]DisposableHandler, 0)

	return err
}

// Reload reloads all loggers.
func Reload() error {
	for _, logger := range loggersToReload {
		if err := logger.Reload(); err != nil {
			return err
		}
	}

	return nil
}

type logWithFilters struct {
	val      gokitlog.Logger
	filters  map[string]level.Option
	maxLevel level.Option
}

func ReadLoggingConfig(modes []string, logsPath string, cfg *ini.File) error {
	if err := Close(); err != nil {
		return err
	}

	logEnabled := cfg.Section("log").Key("enabled").MustBool(true)
	if !logEnabled {
		return nil
	}

	defaultLevelName, _ := getLogLevelFromConfig("log", "info", cfg)
	defaultFilters := getFilters(util.SplitString(cfg.Section("log").Key("filters").String()))

	configLoggers := make([]logWithFilters, 0, len(modes))
	for _, mode := range modes {
		mode = strings.TrimSpace(mode)
		sec, err := cfg.GetSection("log." + mode)
		if err != nil {
			_ = level.Error(root).Log("Unknown log mode", "mode", mode)
			return fmt.Errorf("failed to get config section log. %s: %w", mode, err)
		}

		// Log level.
		_, leveloption := getLogLevelFromConfig("log."+mode, defaultLevelName, cfg)
		modeFilters := getFilters(util.SplitString(sec.Key("filters").String()))

		format := getLogFormat(sec.Key("format").MustString(""))

		var handler logWithFilters

		switch mode {
		case "console":
			handler.val = format(os.Stdout)
		case "file":
			fileName := sec.Key("file_name").MustString(filepath.Join(logsPath, "grafana.log"))
			dpath := filepath.Dir(fileName)
			if err := os.MkdirAll(dpath, 0o750); err != nil {
				_ = level.Error(root).Log("Failed to create directory", "dpath", dpath, "err", err)
				continue
			}
			fileHandler := NewFileWriter()
			fileHandler.Filename = fileName
			fileHandler.Format = format
			fileHandler.Rotate = sec.Key("log_rotate").MustBool(true)
			fileHandler.Maxlines = sec.Key("max_lines").MustInt(1000000)
			fileHandler.Maxsize = 1 << uint(sec.Key("max_size_shift").MustInt(28))
			fileHandler.Daily = sec.Key("daily_rotate").MustBool(true)
			fileHandler.Maxdays = sec.Key("max_days").MustInt64(7)
			if err := fileHandler.Init(); err != nil {
				_ = level.Error(root).Log("Failed to initialize file handler", "dpath", dpath, "err", err)
				continue
			}

			loggersToClose = append(loggersToClose, fileHandler)
			loggersToReload = append(loggersToReload, fileHandler)
			handler.val = fileHandler
		case "syslog":
			sysLogHandler := NewSyslog(sec, format)
			loggersToClose = append(loggersToClose, sysLogHandler)
			handler.val = sysLogHandler.logger
		}
		if handler.val == nil {
			panic(fmt.Sprintf("Handler is uninitialized for mode %q", mode))
		}

		// join default filters and mode filters together
		for key, value := range defaultFilters {
			if _, exist := modeFilters[key]; !exist {
				modeFilters[key] = value
			}
		}

		handler.filters = modeFilters
		handler.maxLevel = leveloption

		configLoggers = append(configLoggers, handler)
	}
	if len(configLoggers) > 0 {
		root.initialize(configLoggers)
	}

	return nil
}

// SetupConsoleLogger setup Grafana console logger with provided level.
func SetupConsoleLogger(level string) error {
	iniFile := ini.Empty()
	sLog, err := iniFile.NewSection("log")
	if err != nil {
		return err
	}

	_, err = sLog.NewKey("level", level)
	if err != nil {
		return err
	}

	sLogConsole, err := iniFile.NewSection("log.console")
	if err != nil {
		return err
	}

	_, err = sLogConsole.NewKey("format", "console")
	if err != nil {
		return err
	}

	err = ReadLoggingConfig([]string{"console"}, "", iniFile)
	if err != nil {
		return err
	}

	return nil
}

func initAppSDKLogger(gkl gokitlog.Logger) {
	// We need to allow Debug logs here. go-kit/log does not support sharing the level we're using.
	// TODO: Refactor such that we can pass in a level in a more appropriate manner.
	logging.DefaultLogger = logging.NewSLogLogger(sloggokit.NewGoKitHandler(gkl, slog.LevelDebug))
}
