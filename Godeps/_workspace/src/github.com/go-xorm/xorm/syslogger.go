// +build !windows,!nacl,!plan9

package xorm

import (
	"fmt"
	"log/syslog"

	"github.com/go-xorm/core"
)

type SyslogLogger struct {
	w *syslog.Writer
}

func NewSyslogLogger(w *syslog.Writer) *SyslogLogger {
	return &SyslogLogger{w: w}
}

func (s *SyslogLogger) Debug(v ...interface{}) (err error) {
	return s.w.Debug(fmt.Sprint(v...))
}

func (s *SyslogLogger) Debugf(format string, v ...interface{}) (err error) {
	return s.w.Debug(fmt.Sprintf(format, v...))
}

func (s *SyslogLogger) Err(v ...interface{}) (err error) {
	return s.w.Err(fmt.Sprint(v...))
}

func (s *SyslogLogger) Errf(format string, v ...interface{}) (err error) {
	return s.w.Err(fmt.Sprintf(format, v...))
}

func (s *SyslogLogger) Info(v ...interface{}) (err error) {
	return s.w.Info(fmt.Sprint(v...))
}

func (s *SyslogLogger) Infof(format string, v ...interface{}) (err error) {
	return s.w.Info(fmt.Sprintf(format, v...))
}

func (s *SyslogLogger) Warning(v ...interface{}) (err error) {
	return s.w.Warning(fmt.Sprint(v...))
}

func (s *SyslogLogger) Warningf(format string, v ...interface{}) (err error) {
	return s.w.Warning(fmt.Sprintf(format, v...))
}

func (s *SyslogLogger) Level() core.LogLevel {
	return core.LOG_UNKNOWN
}

// SetLevel always return error, as current log/syslog package doesn't allow to set priority level after syslog.Writer created
func (s *SyslogLogger) SetLevel(l core.LogLevel) (err error) {
	return fmt.Errorf("unable to set syslog level")
}
