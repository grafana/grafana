// Copyright 2014 The Gogs Authors. All rights reserved.
// Use of this source code is governed by a MIT-style
// license that can be found in the LICENSE file.

package log

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"gopkg.in/ini.v1"

	"github.com/inconshreveable/log15"
)

var Root log15.Logger
var loggersToClose []DisposableHandler

func init() {
	loggersToClose = make([]DisposableHandler, 0)
	Root = log15.Root()
}

func New(logger string, ctx ...interface{}) Logger {
	params := append([]interface{}{"logger", logger}, ctx...)
	return Root.New(params...)
}

func Trace(format string, v ...interface{}) {
	Root.Debug(fmt.Sprintf(format, v))
}

func Debug(format string, v ...interface{}) {
	Root.Debug(fmt.Sprintf(format, v))
}

func Debug2(message string, v ...interface{}) {
	Root.Debug(message, v...)
}

func Info(format string, v ...interface{}) {
	Root.Info(fmt.Sprintf(format, v))
}

func Info2(message string, v ...interface{}) {
	Root.Info(message, v...)
}

func Warn(format string, v ...interface{}) {
	Root.Warn(fmt.Sprintf(format, v))
}

func Warn2(message string, v ...interface{}) {
	Root.Warn(message, v...)
}

func Error(skip int, format string, v ...interface{}) {
	Root.Error(fmt.Sprintf(format, v))
}

func Error2(message string, v ...interface{}) {
	Root.Error(message, v...)
}

func Critical(skip int, format string, v ...interface{}) {
	Root.Crit(fmt.Sprintf(format, v))
}

func Fatal(skip int, format string, v ...interface{}) {
	Root.Crit(fmt.Sprintf(format, v))
	Close()
	os.Exit(1)
}

func Close() {
	for _, logger := range loggersToClose {
		logger.Close()
	}
	loggersToClose = make([]DisposableHandler, 0)
}

var logLevels = map[string]log15.Lvl{
	"Trace":    log15.LvlDebug,
	"Debug":    log15.LvlDebug,
	"Info":     log15.LvlInfo,
	"Warn":     log15.LvlWarn,
	"Error":    log15.LvlError,
	"Critical": log15.LvlCrit,
}

func getLogLevelFromConfig(key string, defaultName string, cfg *ini.File) (string, log15.Lvl) {
	levelName := cfg.Section(key).Key("level").In(defaultName, []string{"Trace", "Debug", "Info", "Warn", "Error", "Critical"})
	level := getLogLevelFromString(levelName)
	return levelName, level
}

func getLogLevelFromString(levelName string) log15.Lvl {
	level, ok := logLevels[levelName]

	if !ok {
		Root.Error("Unknown log level", "level", levelName)
		return log15.LvlError
	}

	return level
}

func getFilters(filterStrArray []string) map[string]log15.Lvl {
	filterMap := make(map[string]log15.Lvl)

	for _, filterStr := range filterStrArray {
		parts := strings.Split(filterStr, ":")
		filterMap[parts[0]] = getLogLevelFromString(parts[1])
	}

	return filterMap
}

func ReadLoggingConfig(modes []string, logsPath string, cfg *ini.File) {
	Close()

	defaultLevelName, _ := getLogLevelFromConfig("log", "Info", cfg)
	defaultFilters := getFilters(cfg.Section("log").Key("filters").Strings(" "))

	handlers := make([]log15.Handler, 0)

	for _, mode := range modes {
		mode = strings.TrimSpace(mode)
		sec, err := cfg.GetSection("log." + mode)
		if err != nil {
			Root.Error("Unknown log mode", "mode", mode)
		}

		// Log level.
		_, level := getLogLevelFromConfig("log."+mode, defaultLevelName, cfg)
		modeFilters := getFilters(sec.Key("filters").Strings(" "))

		var handler log15.Handler

		// Generate log configuration.
		switch mode {
		case "console":
			handler = log15.StdoutHandler
		case "file":
			fileName := sec.Key("file_name").MustString(filepath.Join(logsPath, "grafana.log"))
			os.MkdirAll(filepath.Dir(fileName), os.ModePerm)
			fileHandler := NewFileWriter()
			fileHandler.Filename = fileName
			fileHandler.Rotate = sec.Key("log_rotate").MustBool(true)
			fileHandler.Maxlines = sec.Key("max_lines").MustInt(1000000)
			fileHandler.Maxsize = 1 << uint(sec.Key("max_size_shift").MustInt(28))
			fileHandler.Daily = sec.Key("daily_rotate").MustBool(true)
			fileHandler.Maxdays = sec.Key("max_days").MustInt64(7)
			fileHandler.Init()

			loggersToClose = append(loggersToClose, fileHandler)
			handler = fileHandler
		case "syslog":
			sysLogHandler := NewSyslog()
			sysLogHandler.Network = sec.Key("network").MustString("")
			sysLogHandler.Address = sec.Key("address").MustString("")
			sysLogHandler.Facility = sec.Key("facility").MustString("local7")
			sysLogHandler.Tag = sec.Key("tag").MustString("")

			if err := sysLogHandler.Init(); err != nil {
				Root.Error("Failed to init syslog log handler", "error", err)
				os.Exit(1)
			}

			loggersToClose = append(loggersToClose, sysLogHandler)
			handler = sysLogHandler
		}

		for key, value := range defaultFilters {
			if _, exist := modeFilters[key]; !exist {
				modeFilters[key] = value
			}
		}

		handler = LogFilterHandler(level, modeFilters, handler)
		handlers = append(handlers, handler)
	}

	Root.SetHandler(log15.MultiHandler(handlers...))
}

func LogFilterHandler(maxLevel log15.Lvl, filters map[string]log15.Lvl, h log15.Handler) log15.Handler {
	return log15.FilterHandler(func(r *log15.Record) (pass bool) {

		if len(filters) > 0 {
			for i := 0; i < len(r.Ctx); i += 2 {
				key := r.Ctx[i].(string)
				if key == "logger" {
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
