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

func getLogLevel(key string, defaultName string, cfg *ini.File) (string, log15.Lvl) {
	levelName := cfg.Section(key).Key("level").In(defaultName, []string{"Trace", "Debug", "Info", "Warn", "Error", "Critical"})

	level, ok := logLevels[levelName]
	if !ok {
		Root.Error("Unknown log level", "level", levelName)
	}

	return levelName, level
}

func ReadLoggingConfig(modes []string, logsPath string, cfg *ini.File) {
	Close()

	defaultLevelName, _ := getLogLevel("log", "Info", cfg)
	handlers := make([]log15.Handler, 0)

	for _, mode := range modes {
		mode = strings.TrimSpace(mode)
		sec, err := cfg.GetSection("log." + mode)
		if err != nil {
			Root.Error("Unknown log mode", "mode", mode)
		}

		// Log level.
		_, level := getLogLevel("log."+mode, defaultLevelName, cfg)

		// Generate log configuration.
		switch mode {
		case "console":
			handlers = append(handlers, log15.LvlFilterHandler(level, log15.StdoutHandler))
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
			handlers = append(handlers, log15.LvlFilterHandler(level, fileHandler))

			// case "conn":
			// 	LogConfigs[i] = util.DynMap{
			// 		"level":          level,
			// 		"reconnectOnMsg": sec.Key("reconnect_on_msg").MustBool(),
			// 		"reconnect":      sec.Key("reconnect").MustBool(),
			// 		"net":            sec.Key("protocol").In("tcp", []string{"tcp", "unix", "udp"}),
			// 		"addr":           sec.Key("addr").MustString(":7020"),
			// 	}
			// case "smtp":
			// 	LogConfigs[i] = util.DynMap{
			// 		"level":     level,
			// 		"user":      sec.Key("user").MustString("example@example.com"),
			// 		"passwd":    sec.Key("passwd").MustString("******"),
			// 		"host":      sec.Key("host").MustString("127.0.0.1:25"),
			// 		"receivers": sec.Key("receivers").MustString("[]"),
			// 		"subject":   sec.Key("subject").MustString("Diagnostic message from serve"),
			// 	}
			// case "database":
			// 	LogConfigs[i] = util.DynMap{
			// 		"level":  level,
			// 		"driver": sec.Key("driver").String(),
			// 		"conn":   sec.Key("conn").String(),
			// 	}
			// case "syslog":
			// 	LogConfigs[i] = util.DynMap{
			// 		"level":    level,
			// 		"network":  sec.Key("network").MustString(""),
			// 		"address":  sec.Key("address").MustString(""),
			// 		"facility": sec.Key("facility").MustString("local7"),
			// 		"tag":      sec.Key("tag").MustString(""),
			// 	}
		}
	}

	Root.SetHandler(log15.MultiHandler(handlers...))
}
