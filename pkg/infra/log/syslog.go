//+build !windows,!nacl,!plan9

package log

import (
	"errors"
	"log/syslog"
	"os"

	"github.com/inconshreveable/log15"
	"gopkg.in/ini.v1"
)

type SysLogHandler struct {
	syslog   *syslog.Writer
	Network  string
	Address  string
	Facility string
	Tag      string
	Format   log15.Format
}

func NewSyslog(sec *ini.Section, format log15.Format) *SysLogHandler {
	handler := &SysLogHandler{
		Format: log15.LogfmtFormat(),
	}

	handler.Format = format
	handler.Network = sec.Key("network").MustString("")
	handler.Address = sec.Key("address").MustString("")
	handler.Facility = sec.Key("facility").MustString("local7")
	handler.Tag = sec.Key("tag").MustString("")

	if err := handler.Init(); err != nil {
		Root.Error("Failed to init syslog log handler", "error", err)
		os.Exit(1)
	}

	return handler
}

func (sw *SysLogHandler) Init() error {
	prio, err := parseFacility(sw.Facility)
	if err != nil {
		return err
	}

	w, err := syslog.Dial(sw.Network, sw.Address, prio, sw.Tag)
	if err != nil {
		return err
	}

	sw.syslog = w
	return nil
}

func (sw *SysLogHandler) Log(r *log15.Record) error {
	var err error

	msg := string(sw.Format.Format(r))

	switch r.Lvl {
	case log15.LvlDebug:
		err = sw.syslog.Debug(msg)
	case log15.LvlInfo:
		err = sw.syslog.Info(msg)
	case log15.LvlWarn:
		err = sw.syslog.Warning(msg)
	case log15.LvlError:
		err = sw.syslog.Err(msg)
	case log15.LvlCrit:
		err = sw.syslog.Crit(msg)
	default:
		err = errors.New("invalid syslog level")
	}

	return err
}

func (sw *SysLogHandler) Close() {
	sw.syslog.Close()
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

func parseFacility(facility string) (syslog.Priority, error) {
	prio, ok := facilities[facility]
	if !ok {
		return syslog.LOG_LOCAL0, errors.New("invalid syslog facility")
	}

	return prio, nil
}
