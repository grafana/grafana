// Copyright 2015 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"fmt"
	"io"
	"log"
)

// default log options
const (
	DEFAULT_LOG_PREFIX = "[xorm]"
	DEFAULT_LOG_FLAG   = log.Ldate | log.Lmicroseconds
	DEFAULT_LOG_LEVEL  = LOG_DEBUG
)

var _ coreILogger = DiscardLogger{}

// DiscardLogger don't log implementation for coreILogger
type DiscardLogger struct{}

// Debug empty implementation
func (DiscardLogger) Debug(v ...any) {}

// Debugf empty implementation
func (DiscardLogger) Debugf(format string, v ...any) {}

// Error empty implementation
func (DiscardLogger) Error(v ...any) {}

// Errorf empty implementation
func (DiscardLogger) Errorf(format string, v ...any) {}

// Info empty implementation
func (DiscardLogger) Info(v ...any) {}

// Infof empty implementation
func (DiscardLogger) Infof(format string, v ...any) {}

// Warn empty implementation
func (DiscardLogger) Warn(v ...any) {}

// Warnf empty implementation
func (DiscardLogger) Warnf(format string, v ...any) {}

// Level empty implementation
func (DiscardLogger) Level() coreLogLevel {
	return LOG_UNKNOWN
}

// SetLevel empty implementation
func (DiscardLogger) SetLevel(l coreLogLevel) {}

// ShowSQL empty implementation
func (DiscardLogger) ShowSQL(show ...bool) {}

// IsShowSQL empty implementation
func (DiscardLogger) IsShowSQL() bool {
	return false
}

// SimpleLogger is the default implment of coreILogger
type SimpleLogger struct {
	DEBUG   *log.Logger
	ERR     *log.Logger
	INFO    *log.Logger
	WARN    *log.Logger
	level   coreLogLevel
	showSQL bool
}

var _ coreILogger = &SimpleLogger{}

// NewSimpleLogger use a special io.Writer as logger output
func NewSimpleLogger(out io.Writer) *SimpleLogger {
	return &SimpleLogger{
		DEBUG: log.New(out, fmt.Sprintf("%s [debug] ", DEFAULT_LOG_PREFIX), DEFAULT_LOG_FLAG),
		ERR:   log.New(out, fmt.Sprintf("%s [error] ", DEFAULT_LOG_PREFIX), DEFAULT_LOG_FLAG),
		INFO:  log.New(out, fmt.Sprintf("%s [info]  ", DEFAULT_LOG_PREFIX), DEFAULT_LOG_FLAG),
		WARN:  log.New(out, fmt.Sprintf("%s [warn]  ", DEFAULT_LOG_PREFIX), DEFAULT_LOG_FLAG),
		level: DEFAULT_LOG_LEVEL,
	}
}

// Error implement coreILogger
func (s *SimpleLogger) Error(v ...any) {
	if s.level <= LOG_ERR {
		s.ERR.Output(2, fmt.Sprint(v...))
	}
}

// Errorf implement coreILogger
func (s *SimpleLogger) Errorf(format string, v ...any) {
	if s.level <= LOG_ERR {
		s.ERR.Output(2, fmt.Sprintf(format, v...))
	}
}

// Debug implement coreILogger
func (s *SimpleLogger) Debug(v ...any) {
	if s.level <= LOG_DEBUG {
		s.DEBUG.Output(2, fmt.Sprint(v...))
	}
}

// Debugf implement coreILogger
func (s *SimpleLogger) Debugf(format string, v ...any) {
	if s.level <= LOG_DEBUG {
		s.DEBUG.Output(2, fmt.Sprintf(format, v...))
	}
}

// Info implement coreILogger
func (s *SimpleLogger) Info(v ...any) {
	if s.level <= LOG_INFO {
		s.INFO.Output(2, fmt.Sprint(v...))
	}
}

// Infof implement coreILogger
func (s *SimpleLogger) Infof(format string, v ...any) {
	if s.level <= LOG_INFO {
		s.INFO.Output(2, fmt.Sprintf(format, v...))
	}
}

// Warn implement coreILogger
func (s *SimpleLogger) Warn(v ...any) {
	if s.level <= LOG_WARNING {
		s.WARN.Output(2, fmt.Sprint(v...))
	}
}

// Warnf implement coreILogger
func (s *SimpleLogger) Warnf(format string, v ...any) {
	if s.level <= LOG_WARNING {
		s.WARN.Output(2, fmt.Sprintf(format, v...))
	}
}

// Level implement coreILogger
func (s *SimpleLogger) Level() coreLogLevel {
	return s.level
}

// SetLevel implement coreILogger
func (s *SimpleLogger) SetLevel(l coreLogLevel) {
	s.level = l
}

// ShowSQL implement coreILogger
func (s *SimpleLogger) ShowSQL(show ...bool) {
	if len(show) == 0 {
		s.showSQL = true
		return
	}
	s.showSQL = show[0]
}

// IsShowSQL implement coreILogger
func (s *SimpleLogger) IsShowSQL() bool {
	return s.showSQL
}
