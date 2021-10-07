//go:build !windows && !nacl && !plan9
// +build !windows,!nacl,!plan9

package log

import (
	"errors"
	gosyslog "log/syslog"
	"os"

	"github.com/go-kit/log"
	"gopkg.in/ini.v1"
)

type SysLogHandler struct {
	l        log.Logger
	syslog   *gosyslog.Writer
	Network  string
	Address  string
	Facility string
	Tag      string
	Format   Formatedlogger
}

func NewSyslog(sec *ini.Section, formatfn Formatedlogger) *SysLogHandler {
	// example of syslog
	// w, err := gosyslog.New(gosyslog.LOG_INFO, "experiment")
	// if err != nil {
	// 	fmt.Println(err)
	// 	// return
	// }

	// // syslog logger with logfmt formatting
	// logger := syslog.NewSyslogLogger(w, log.NewLogfmtLogger)
	// logger.Log("msg", "info because of default")
	// logger.Log(level.Key(), level.DebugValue(), "msg", "debug because of explicit level")

	w, _ := gosyslog.New(gosyslog.LOG_INFO, "experiment")
	handler := &SysLogHandler{
		syslog: w,
	}
	handler.l = formatfn(w)
	handler.Network = sec.Key("network").MustString("")
	handler.Address = sec.Key("address").MustString("")
	handler.Facility = sec.Key("facility").MustString("local7")
	handler.Tag = sec.Key("tag").MustString("")

	if err := handler.Init(); err != nil {
		// Root.Error("Failed to init syslog log handler", "error", err)
		os.Exit(1)
	}

	return handler
}

func (sw *SysLogHandler) Init() error {
	prio, err := parseFacility(sw.Facility)
	if err != nil {
		return err
	}

	w, err := gosyslog.Dial(sw.Network, sw.Address, prio, sw.Tag)
	if err != nil {
		return err
	}

	sw.syslog = w
	return nil
}

func (sw *SysLogHandler) Log(keyvals ...interface{}) error {
	var err error

	i := 0
	for ; i < len(keyvals)-1; i += 2 {
		if keyvals[i] != "level" {
			continue
		}
		msg := append(keyvals[:i], keyvals[i+2:]...)
		switch keyvals[i+1] {
		case "debug":
			err = sw.syslog.Debug()
		case "info":
			err = sw.syslog.Info(msg)
		case "warn":
			err = sw.syslog.Warning(msg)
		case "error":
			err = sw.syslog.Err(msg)
		case "crit":
			err = sw.syslog.Crit(msg)
		default:
			err = errors.New("invalid syslog level")
		}
	}

	return err
}

func (sw *SysLogHandler) Close() error {
	return sw.syslog.Close()
}

var facilities = map[string]gosyslog.Priority{
	"user":   gosyslog.LOG_USER,
	"daemon": gosyslog.LOG_DAEMON,
	"local0": gosyslog.LOG_LOCAL0,
	"local1": gosyslog.LOG_LOCAL1,
	"local2": gosyslog.LOG_LOCAL2,
	"local3": gosyslog.LOG_LOCAL3,
	"local4": gosyslog.LOG_LOCAL4,
	"local5": gosyslog.LOG_LOCAL5,
	"local6": gosyslog.LOG_LOCAL6,
	"local7": gosyslog.LOG_LOCAL7,
}

func parseFacility(facility string) (gosyslog.Priority, error) {
	prio, ok := facilities[facility]
	if !ok {
		return gosyslog.LOG_LOCAL0, errors.New("invalid syslog facility")
	}

	return prio, nil
}
