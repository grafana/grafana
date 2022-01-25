// Copyright 2014 The Gogs Authors. All rights reserved.
// Use of this source code is governed by a MIT-style
// license that can be found in the LICENSE file.

package log

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	gokitlog "github.com/go-kit/log"
	"github.com/go-kit/log/term"
	"github.com/go-stack/stack"
	"github.com/mattn/go-isatty"
	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/infra/log/level"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/errutil"
)

var loggersToClose []DisposableHandler
var loggersToReload []ReloadableHandler
var filters map[string]level.Option
var Root MultiLoggers

const (
	// top 7 calls in the stack are within logger
	DefaultCallerDepth = 7
	CallerContextKey   = "caller"
)

func init() {
	loggersToClose = make([]DisposableHandler, 0)
	loggersToReload = make([]ReloadableHandler, 0)
	filters = map[string]level.Option{}
	Root.AddLogger(gokitlog.NewLogfmtLogger(os.Stderr), "info", filters)
}

type LogWithFilters struct {
	val      gokitlog.Logger
	filters  map[string]level.Option
	maxLevel level.Option
}

type MultiLoggers struct {
	loggers []LogWithFilters
}

func (ml *MultiLoggers) AddLogger(val gokitlog.Logger, levelName string, filters map[string]level.Option) {
	logger := LogWithFilters{val: val, filters: filters, maxLevel: getLogLevelFromString(levelName)}
	ml.loggers = append(ml.loggers, logger)
}

func (ml *MultiLoggers) SetLogger(des MultiLoggers) {
	ml.loggers = des.loggers
}

func (ml *MultiLoggers) GetLogger() MultiLoggers {
	return *ml
}

func (ml MultiLoggers) Warn(msg string, args ...interface{}) {
	args = append([]interface{}{level.Key(), level.WarnValue(), "msg", msg}, args...)
	err := ml.Log(args...)
	if err != nil {
		_ = level.Error(Root).Log("Logging error", "error", err)
	}
}

func (ml MultiLoggers) Debug(msg string, args ...interface{}) {
	args = append([]interface{}{level.Key(), level.DebugValue(), "msg", msg}, args...)
	err := ml.Log(args...)
	if err != nil {
		_ = level.Error(Root).Log("Logging error", "error", err)
	}
}

func (ml MultiLoggers) Error(msg string, args ...interface{}) {
	args = append([]interface{}{level.Key(), level.ErrorValue(), "msg", msg}, args...)
	err := ml.Log(args...)
	if err != nil {
		_ = level.Error(Root).Log("Logging error", "error", err)
	}
}

func (ml MultiLoggers) Info(msg string, args ...interface{}) {
	args = append([]interface{}{level.Key(), level.InfoValue(), "msg", msg}, args...)
	err := ml.Log(args...)
	if err != nil {
		_ = level.Error(Root).Log("Logging error", "error", err)
	}
}

func (ml MultiLoggers) Log(keyvals ...interface{}) error {
	for _, multilogger := range ml.loggers {
		multilogger.val = gokitlog.With(multilogger.val, "t", gokitlog.TimestampFormat(time.Now, "2006-01-02T15:04:05.99-0700"))
		if err := multilogger.val.Log(keyvals...); err != nil {
			return err
		}
	}
	return nil
}

// New creates a new logger from the existing one with additional context
func (ml MultiLoggers) New(ctx ...interface{}) MultiLoggers {
	return with(ml, gokitlog.With, ctx)
}

// New creates MultiLoggers with the provided context and caller that is added as a suffix.
// The first element of the context must be the logger name
func New(ctx ...interface{}) MultiLoggers {
	if len(ctx) == 0 {
		return Root
	}
	var newloger MultiLoggers
	ctx = append([]interface{}{"logger"}, ctx...)
	for _, logWithFilter := range Root.loggers {
		logWithFilter.val = gokitlog.With(logWithFilter.val, ctx...)
		v, ok := logWithFilter.filters[ctx[0].(string)]
		if ok {
			logWithFilter.val = level.NewFilter(logWithFilter.val, v)
		} else {
			logWithFilter.val = level.NewFilter(logWithFilter.val, logWithFilter.maxLevel)
		}
		newloger.loggers = append(newloger.loggers, logWithFilter)
	}
	return newloger
}

func with(loggers MultiLoggers, withFunc func(gokitlog.Logger, ...interface{}) gokitlog.Logger, ctx []interface{}) MultiLoggers {
	if len(ctx) == 0 {
		return loggers
	}
	var newloger MultiLoggers
	for _, l := range loggers.loggers {
		l.val = withFunc(l.val, ctx...)
		newloger.loggers = append(newloger.loggers, l)
	}
	return newloger
}

// WithPrefix adds context that will be added to the log message
func WithPrefix(loggers MultiLoggers, ctx ...interface{}) MultiLoggers {
	return with(loggers, gokitlog.WithPrefix, ctx)
}

// WithSuffix adds context that will be appended at the end of the log message
func WithSuffix(loggers MultiLoggers, ctx ...interface{}) MultiLoggers {
	return with(loggers, gokitlog.WithSuffix, ctx)
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
		_ = level.Error(Root).Log("Unknown log level", "level", levelName)
		return level.AllowError()
	}

	return loglevel
}

// the filter is composed with logger name and level
func getFilters(filterStrArray []string) map[string]level.Option {
	filterMap := make(map[string]level.Option)

	for _, filterStr := range filterStrArray {
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
	return func() interface{} {
		return Stack(skip + 1)
	}
}

// Caller proxies go-kit/log Caller and returns a Valuer function that returns a file and line from a specified depth
// in the callstack
func Caller(depth int) gokitlog.Valuer {
	return gokitlog.Caller(depth)
}

type Formatedlogger func(w io.Writer) gokitlog.Logger

func terminalColorFn(keyvals ...interface{}) term.FgBgColor {
	for i := 0; i < len(keyvals)-1; i += 2 {
		if keyvals[i] != level.Key() {
			continue
		}
		switch keyvals[i+1] {
		case "trace":
			return term.FgBgColor{Fg: term.Gray}
		case level.DebugValue():
			return term.FgBgColor{Fg: term.Gray}
		case level.InfoValue():
			return term.FgBgColor{Fg: term.Green}
		case level.WarnValue():
			return term.FgBgColor{Fg: term.Yellow}
		case level.ErrorValue():
			return term.FgBgColor{Fg: term.Red}
		case "crit":
			return term.FgBgColor{Fg: term.Gray, Bg: term.DarkRed}
		default:
			return term.FgBgColor{}
		}
	}
	return term.FgBgColor{}
}

func getLogFormat(format string) Formatedlogger {
	switch format {
	case "console":
		if isatty.IsTerminal(os.Stdout.Fd()) {
			return func(w io.Writer) gokitlog.Logger {
				return term.NewColorLogger(w, gokitlog.NewLogfmtLogger, terminalColorFn)
			}
		}
		return func(w io.Writer) gokitlog.Logger {
			return gokitlog.NewLogfmtLogger(w)
		}
	case "text":
		return func(w io.Writer) gokitlog.Logger {
			return gokitlog.NewLogfmtLogger(w)
		}
	case "json":
		return func(w io.Writer) gokitlog.Logger {
			return gokitlog.NewJSONLogger(gokitlog.NewSyncWriter(w))
		}
	default:
		return func(w io.Writer) gokitlog.Logger {
			return gokitlog.NewLogfmtLogger(w)
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

func ReadLoggingConfig(modes []string, logsPath string, cfg *ini.File) error {
	if err := Close(); err != nil {
		return err
	}

	defaultLevelName, _ := getLogLevelFromConfig("log", "info", cfg)
	defaultFilters := getFilters(util.SplitString(cfg.Section("log").Key("filters").String()))

	var configLoggers []LogWithFilters
	for _, mode := range modes {
		mode = strings.TrimSpace(mode)
		sec, err := cfg.GetSection("log." + mode)
		if err != nil {
			_ = level.Error(Root).Log("Unknown log mode", "mode", mode)
			return errutil.Wrapf(err, "failed to get config section log.%s", mode)
		}

		// Log level.
		_, leveloption := getLogLevelFromConfig("log."+mode, defaultLevelName, cfg)
		modeFilters := getFilters(util.SplitString(sec.Key("filters").String()))

		format := getLogFormat(sec.Key("format").MustString(""))

		var handler LogWithFilters

		switch mode {
		case "console":
			handler.val = format(os.Stdout)
		case "file":
			fileName := sec.Key("file_name").MustString(filepath.Join(logsPath, "grafana.log"))
			dpath := filepath.Dir(fileName)
			if err := os.MkdirAll(dpath, os.ModePerm); err != nil {
				_ = level.Error(Root).Log("Failed to create directory", "dpath", dpath, "err", err)
				return errutil.Wrapf(err, "failed to create log directory %q", dpath)
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
				_ = level.Error(Root).Log("Failed to initialize file handler", "dpath", dpath, "err", err)
				return errutil.Wrapf(err, "failed to initialize file handler")
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

		// copy joined default + mode filters into filters
		for key, value := range modeFilters {
			if _, exist := filters[key]; !exist {
				filters[key] = value
			}
		}

		handler.filters = modeFilters
		handler.maxLevel = leveloption
		// handler = LogFilterHandler(leveloption, modeFilters, handler)
		configLoggers = append(configLoggers, handler)
	}
	if len(configLoggers) > 0 {
		Root.loggers = configLoggers
	}
	return nil
}
