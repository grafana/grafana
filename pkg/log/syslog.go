package log

import (
	"encoding/json"
	"errors"
	"log/syslog"
)

type SyslogWriter struct {
	syslog   *syslog.Writer
	Network  string `json:"network"`
	Address  string `json:"address"`
	Facility string `json:"facility"`
	Tag      string `json:"tag"`
}

func NewSyslog() LoggerInterface {
	return new(SyslogWriter)
}

func (sw *SyslogWriter) Init(config string) error {
	if err := json.Unmarshal([]byte(config), sw); err != nil {
		return err
	}

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

func (sw *SyslogWriter) WriteMsg(msg string, skip, level int) error {
	var err error

	switch level {
	case TRACE, DEBUG:
		err = sw.syslog.Debug(msg)
	case INFO:
		err = sw.syslog.Info(msg)
	case WARN:
		err = sw.syslog.Warning(msg)
	case ERROR:
		err = sw.syslog.Err(msg)
	case CRITICAL:
		err = sw.syslog.Crit(msg)
	case FATAL:
		err = sw.syslog.Alert(msg)
	default:
		err = errors.New("invalid syslog level")
	}

	return err
}

func (sw *SyslogWriter) Destroy() {
	sw.syslog.Close()
}

func (sw *SyslogWriter) Flush() {}

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

func init() {
	Register("syslog", NewSyslog)
}
