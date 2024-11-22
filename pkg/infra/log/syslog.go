//go:build !windows && !nacl && !plan9
// +build !windows,!nacl,!plan9

package log

import (
	"fmt"
	"log/syslog"
	"os"

	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
	gokitsyslog "github.com/go-kit/log/syslog"
	"gopkg.in/ini.v1"
)

type SysLogHandler struct {
	syslog   *syslog.Writer
	Network  string
	Address  string
	Facility string
	Tag      string
	Format   Formatedlogger
	logger   log.Logger
}

var selector = func(keyvals ...any) syslog.Priority {
	for i := 0; i < len(keyvals); i += 2 {
		if keyvals[i] == level.Key() {
			val := keyvals[i+1]
			if val != nil {
				switch val {
				case level.ErrorValue():
					return syslog.LOG_ERR
				case level.WarnValue():
					return syslog.LOG_WARNING
				case level.InfoValue():
					return syslog.LOG_INFO
				case level.DebugValue():
					return syslog.LOG_DEBUG
				}
			}
			break
		}
	}
	return syslog.LOG_INFO
}

func NewSyslog(sec *ini.Section, format Formatedlogger) *SysLogHandler {
	handler := &SysLogHandler{}

	handler.Format = format
	handler.Network = sec.Key("network").MustString("")
	handler.Address = sec.Key("address").MustString("")
	handler.Facility = sec.Key("facility").MustString("local7")
	handler.Tag = sec.Key("tag").MustString("")

	if err := handler.Init(); err != nil {
		fmt.Printf("Failed to init syslog handler. Error: %v\n", err)
		root.Error("Failed to init syslog log handler", "error", err)
		os.Exit(1)
	}
	handler.logger = gokitsyslog.NewSyslogLogger(handler.syslog, format, gokitsyslog.PrioritySelectorOption(selector))

	if err := handler.Log("msg", "syslog logger initialized"); err != nil {
		fmt.Printf("Failed to log to syslog handler. Error: %v\n", err)
		root.Error("Failed to log to syslog log handler", "error", err)
		os.Exit(1)
	}

	return handler
}

func (sw *SysLogHandler) Init() error {
	// the facility is the origin of the syslog message
	prio := parseFacility(sw.Facility)

	w, err := syslog.Dial(sw.Network, sw.Address, prio, sw.Tag)
	if err != nil {
		return err
	}

	sw.syslog = w
	return nil
}

func (sw *SysLogHandler) Log(keyvals ...any) error {
	err := sw.logger.Log(keyvals...)
	return err
}

func (sw *SysLogHandler) Close() error {
	return sw.syslog.Close()
}

var facilities = map[string]syslog.Priority{
	"user":   syslog.LOG_USER,
	"daemon": syslog.LOG_DAEMON,
	"local0": syslog.LOG_LOCAL0,
	"local1": syslog.LOG_LOCAL1,
	"local2": syslog.LOG_LOCAL2,
	"local3": syslog.LOG_LOCAL3,
	"local4": syslog.LOG_LOCAL4,
	"local5": syslog.LOG_LOCAL5,
	"local6": syslog.LOG_LOCAL6,
	"local7": syslog.LOG_LOCAL7,
}

func parseFacility(facility string) syslog.Priority {
	v, found := facilities[facility]
	if !found {
		// default the facility level to LOG_LOCAL7
		return syslog.LOG_LOCAL7
	}
	return v
}
