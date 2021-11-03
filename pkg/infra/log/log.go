// Copyright 2014 The Gogs Authors. All rights reserved.
// Use of this source code is governed by a MIT-style
// license that can be found in the LICENSE file.

package log

import (
	"fmt"
	"io"
	gosyslog "log/syslog"
	"os"
	"path/filepath"
	"strings"

	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
	"github.com/go-kit/log/syslog"
	"github.com/go-kit/log/term"
	"github.com/go-stack/stack"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/errutil"
	"github.com/inconshreveable/log15"
	isatty "github.com/mattn/go-isatty"
	"gopkg.in/ini.v1"
)

type LogWithFilters struct {
	val     log.Logger
	filters map[string]level.Option
}
type MultiLoggers struct {
	loggers []LogWithFilters
}

// log with all logers inside of multiloggers
func (ml *MultiLoggers) Log(keyvals ...interface{}) error {
	for _, logger := range ml.loggers {
		if err := logger.val.Log(keyvals...); err != nil {
			return err
		}
	}
	return nil
}

func (ml *MultiLoggers) LogWithLevel(fn func(log.Logger) log.Logger, keyvals ...interface{}) {
	for _, logger := range ml.loggers {
		fn(logger.val).Log(keyvals)
	}
}

var Root MultiLoggers

// for file logger
var loggersToClose []DisposableHandler
var loggersToReload []ReloadableHandler

var llog log.Logger

// var filters map[string]level.Option

func init() {
	loggersToClose = make([]DisposableHandler, 0)
	loggersToReload = make([]ReloadableHandler, 0)
	llog = log.NewLogfmtLogger(os.Stderr)
}

func New(logger string, ctx ...interface{}) MultiLoggers {
	params := append([]interface{}{"logger", logger}, ctx...)
	var newloger MultiLoggers
	for _, val := range Root.loggers {
		val.val = log.With(val.val, params...)
		newloger.loggers = append(newloger.loggers, val)
	}
	return newloger
}

<<<<<<< HEAD
=======
func (rt *MultiLoggers) Warn(msg string, v ...interface{}) {
	params := append([]interface{}{"msg", msg}, v...)
	rt.Log(level.Key(), level.WarnValue(), "msg", params)
}

func (rt *MultiLoggers) Debug(msg string, v ...interface{}) {
	params := append([]interface{}{"msg", msg}, v...)
	rt.Log(level.Key(), level.DebugValue(), "msg", params)
}

func (rt *MultiLoggers) Info(msg string, v ...interface{}) {
	params := append([]interface{}{"msg", msg}, v...)
	rt.Log(level.Key(), level.InfoValue(), "msg", params)
}

func Error(msg string, args ...interface{}) {
	params := append([]interface{}{"msg", msg}, args...)
	Root.LogWithLevel(level.Error, params...)
}

>>>>>>> cf2a3708c4 (syslog)
var logLevels = map[string]log15.Lvl{
	"trace":    log15.LvlDebug,
	"debug":    log15.LvlDebug,
	"info":     log15.LvlInfo,
	"warn":     log15.LvlWarn,
	"error":    log15.LvlError,
	"critical": log15.LvlCrit,
}

func getLogLevelFromConfig(key string, defaultName string, cfg *ini.File) (string, level.Option) {
	levelName := cfg.Section(key).Key("level").MustString(defaultName)
	levelName = strings.ToLower(levelName)
	level := getLogLevelFromString(levelName)
	return levelName, level
}

func getLogLevelFromString(levelName string) level.Option {
	selectedlevel, ok := logLevels[levelName]
	// if the input string is unknown, for security, we allow no log? or should we just allow error
	if !ok {
		level.Error(llog).Log("msg", "Unknown log level", "level", levelName)
		return level.AllowError()
	}
	return selectedlevel
}

// we configure the log level by logger
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

type Formatedlogger func(interface{}) log.Logger

func getLoggerOfFormat(format string) Formatedlogger {
	switch format {
	case "json":
		return func(w interface{}) log.Logger {
			// return log.NewJSONLogger(log.NewSyncWriter(os.Stdout))
			return log.NewJSONLogger(w.(io.Writer))
		}
	case "console":
		colorFn := func(keyvals ...interface{}) term.FgBgColor {
			for i := 0; i < len(keyvals)-1; i += 2 {
				if keyvals[i] != "level" {
					continue
				}
				switch keyvals[i+1] {
				case "debug":
					return term.FgBgColor{Fg: term.DarkGray}
				case "info":
					return term.FgBgColor{Fg: term.Gray}
				case "warn":
					return term.FgBgColor{Fg: term.Yellow}
				case "error":
					return term.FgBgColor{Fg: term.Red}
				case "crit":
					return term.FgBgColor{Fg: term.Gray, Bg: term.DarkRed}
				default:
					return term.FgBgColor{}
				}
			}
			return term.FgBgColor{}
		}
		if isatty.IsTerminal(os.Stdout.Fd()) {
			return func(w interface{}) log.Logger {
				// return term.NewLogger(os.Stdout, log.NewLogfmtLogger, colorFn)
				return term.NewLogger(w.(io.Writer), log.NewLogfmtLogger, colorFn)
			}
		}
		// multi := io.MultiWriter(file, os.Stdout)
		// log.NewLogfmtLogger(multi)
		return func(w interface{}) log.Logger {
			// return log.NewLogfmtLogger(log.NewSyncWriter(os.Stdout))
			return log.NewLogfmtLogger(w.(io.Writer))
		}
	case "syslog":
		// w, err := gosyslog.New(gosyslog.LOG_INFO, "experiment")
		return func(w interface{}) log.Logger {
			return syslog.NewSyslogLogger(w.(*gosyslog.Writer), log.NewLogfmtLogger)
		}
	case "text":
		fallthrough
	default:
		return func(w interface{}) log.Logger {
			// return log.NewLogfmtLogger(log.NewSyncWriter(os.Stdout))
			return log.NewLogfmtLogger(w.(io.Writer))
		}
	}
}

// --------------------------------------------------------------------------------------
// those interface is more for log into file and avoid concurrency on file writting, need
// to find equivalences

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

// Reload all loggers.
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
	// the default log level
	defaultLevelName, _ := getLogLevelFromConfig("log", "info", cfg)

	// the log level filter per logger
	defaultFilters := getFilters(util.SplitString(cfg.Section("log").Key("filters").String()))

	// Initialize the root multi logger with settings
	Root = MultiLoggers{}

	// get all the supported modes, and the configuration of the selected mode
	for _, mode := range modes {
		mode = strings.TrimSpace(mode)
		sec, err := cfg.GetSection("log." + mode)
		if err != nil {
			Error("Unknown log mode", "mode", mode)
			return errutil.Wrapf(err, "failed to get config section log.%s", mode)
		}

		// get log level for the dedicated mode
		_, level := getLogLevelFromConfig("log."+mode, defaultLevelName, cfg)

		// get log filter for the dedicated mode, we need to store the map, since now the "sub logger" is not created yet
		modeFilters := getFilters(util.SplitString(sec.Key("filters").String()))

		handlerfn := getLoggerOfFormat(sec.Key("format").MustString(""))
		var handler log.Logger

		switch mode {
		case "console":
			handler = handlerfn(os.Stdout)
		case "file":
			fileName := sec.Key("file_name").MustString(filepath.Join(logsPath, "grafana.log"))
			dpath := filepath.Dir(fileName)
			if err := os.MkdirAll(dpath, os.ModePerm); err != nil {
				// log.Error("Failed to create directory", "dpath", dpath, "err", err)
				return errutil.Wrapf(err, "failed to create log directory %q", dpath)
			}
			fileHandler := NewFileHandler()
			fileHandler.Filename = fileName
			fileHandler.Format = handlerfn
			fileHandler.Rotate = sec.Key("log_rotate").MustBool(true)
			fileHandler.Maxlines = sec.Key("max_lines").MustInt(1000000)
			fileHandler.Maxsize = 1 << uint(sec.Key("max_size_shift").MustInt(28))
			fileHandler.Daily = sec.Key("daily_rotate").MustBool(true)
			fileHandler.Maxdays = sec.Key("max_days").MustInt64(7)
			if err := fileHandler.Init(); err != nil {
				// Root.Error("Failed to initialize file handler", "dpath", dpath, "err", err)
				return errutil.Wrapf(err, "failed to initialize file handler")
			}

			loggersToClose = append(loggersToClose, fileHandler)
			loggersToReload = append(loggersToReload, fileHandler)
			handler = handlerfn(&fileHandler)

		case "syslog":
			sysLogHandler := NewSyslog(sec, handlerfn)
			loggersToClose = append(loggersToClose, sysLogHandler)
			handler = sysLogHandler
		}
		if handler == nil {
			panic(fmt.Sprintf("Handler is uninitialized for mode %q", mode))
		}

		// we always add the default filter as supplementary if not overwrite in the mode filter
		for key, value := range defaultFilters {
			if _, exist := modeFilters[key]; !exist {
				modeFilters[key] = value
			}
		}

		// I don't think we need a global filter anymore knowing that we it would be by logger
		// for key, value := range modeFilters {
		// 	if _, exist := filters[key]; !exist {
		// 		filters[key] = value
		// 	}
		// }

		handler = LogFilterHandler(level, modeFilters, handler)
		handlers = append(handlers, handler)
	}

	Root.SetHandler(log.MultiHandler(handlers...))
	return nil
}

// here we can actually replace the handler by level.NewFilter,
// because it is actually just controle the level of logs that would be showed
func LogFilterHandler(maxLevel log.Lvl, filters map[string]log.Lvl, h log.Handler) log.Handler {
	return log.FilterHandler(func(r *log.Record) (pass bool) {
		if len(filters) > 0 {
			for i := 0; i < len(r.Ctx); i += 2 {
				key, ok := r.Ctx[i].(string)
				if ok && key == "logger" {
					loggerName, strOk := r.Ctx[i+1].(string)
					if strOk {
						if filterLevel, ok := filters[loggerName]; ok {
							return r.Lvl <= filterLevel
						}
					}
				}
			}
		}

		return r.Lvl <= maxLevel
	}, h)
}

func Stack(skip int) string {
	call := stack.Caller(skip)
	s := stack.Trace().TrimBelow(call).TrimRuntime()
	return s.String()
}
