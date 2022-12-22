// Copyright 2015 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// +build !windows,!nacl,!plan9

package xorm

import (
	"fmt"
	"log/syslog"

	"xorm.io/core"
)

var _ core.ILogger = &SyslogLogger{}

// SyslogLogger will be depricated
type SyslogLogger struct {
	w       *syslog.Writer
	showSQL bool
}

// NewSyslogLogger implements core.ILogger
func NewSyslogLogger(w *syslog.Writer) *SyslogLogger {
	return &SyslogLogger{w: w}
}

// Debug log content as Debug
func (s *SyslogLogger) Debug(v ...interface{}) {
	s.w.Debug(fmt.Sprint(v...))
}

// Debugf log content as Debug and format
func (s *SyslogLogger) Debugf(format string, v ...interface{}) {
	s.w.Debug(fmt.Sprintf(format, v...))
}

// Error log content as Error
func (s *SyslogLogger) Error(v ...interface{}) {
	s.w.Err(fmt.Sprint(v...))
}

// Errorf log content as Errorf and format
func (s *SyslogLogger) Errorf(format string, v ...interface{}) {
	s.w.Err(fmt.Sprintf(format, v...))
}

// Info log content as Info
func (s *SyslogLogger) Info(v ...interface{}) {
	s.w.Info(fmt.Sprint(v...))
}

// Infof log content as Infof and format
func (s *SyslogLogger) Infof(format string, v ...interface{}) {
	s.w.Info(fmt.Sprintf(format, v...))
}

// Warn log content as Warn
func (s *SyslogLogger) Warn(v ...interface{}) {
	s.w.Warning(fmt.Sprint(v...))
}

// Warnf log content as Warnf and format
func (s *SyslogLogger) Warnf(format string, v ...interface{}) {
	s.w.Warning(fmt.Sprintf(format, v...))
}

// Level shows log level
func (s *SyslogLogger) Level() core.LogLevel {
	return core.LOG_UNKNOWN
}

// SetLevel always return error, as current log/syslog package doesn't allow to set priority level after syslog.Writer created
func (s *SyslogLogger) SetLevel(l core.LogLevel) {}

// ShowSQL set if logging SQL
func (s *SyslogLogger) ShowSQL(show ...bool) {
	if len(show) == 0 {
		s.showSQL = true
		return
	}
	s.showSQL = show[0]
}

// IsShowSQL if logging SQL
func (s *SyslogLogger) IsShowSQL() bool {
	return s.showSQL
}
