// Copyright 2015 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"fmt"
	"io"
	"log"

	"xorm.io/core"
)

// default log options
const (
	DEFAULT_LOG_PREFIX = "[xorm]"
	DEFAULT_LOG_FLAG   = log.Ldate | log.Lmicroseconds
	DEFAULT_LOG_LEVEL  = core.LOG_DEBUG
)

var _ core.ILogger = DiscardLogger{}

// DiscardLogger don't log implementation for core.ILogger
type DiscardLogger struct{}

// Debug empty implementation
func (DiscardLogger) Debug(v ...interface{}) {}

// Debugf empty implementation
func (DiscardLogger) Debugf(format string, v ...interface{}) {}

// Error empty implementation
func (DiscardLogger) Error(v ...interface{}) {}

// Errorf empty implementation
func (DiscardLogger) Errorf(format string, v ...interface{}) {}

// Info empty implementation
func (DiscardLogger) Info(v ...interface{}) {}

// Infof empty implementation
func (DiscardLogger) Infof(format string, v ...interface{}) {}

// Warn empty implementation
func (DiscardLogger) Warn(v ...interface{}) {}

// Warnf empty implementation
func (DiscardLogger) Warnf(format string, v ...interface{}) {}

// Level empty implementation
func (DiscardLogger) Level() core.LogLevel {
	return core.LOG_UNKNOWN
}

// SetLevel empty implementation
func (DiscardLogger) SetLevel(l core.LogLevel) {}

// ShowSQL empty implementation
func (DiscardLogger) ShowSQL(show ...bool) {}

// IsShowSQL empty implementation
func (DiscardLogger) IsShowSQL() bool {
	return false
}

// SimpleLogger is the default implment of core.ILogger
type SimpleLogger struct {
	DEBUG   *log.Logger
	ERR     *log.Logger
	INFO    *log.Logger
	WARN    *log.Logger
	level   core.LogLevel
	showSQL bool
}

var _ core.ILogger = &SimpleLogger{}

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

// Error implement core.ILogger
func (s *SimpleLogger) Error(v ...interface{}) {
	if s.level <= core.LOG_ERR {
		s.ERR.Output(2, fmt.Sprint(v...))
	}
}

// Errorf implement core.ILogger
func (s *SimpleLogger) Errorf(format string, v ...interface{}) {
	if s.level <= core.LOG_ERR {
		s.ERR.Output(2, fmt.Sprintf(format, v...))
	}
}

// Debug implement core.ILogger
func (s *SimpleLogger) Debug(v ...interface{}) {
	if s.level <= core.LOG_DEBUG {
		s.DEBUG.Output(2, fmt.Sprint(v...))
	}
}

// Debugf implement core.ILogger
func (s *SimpleLogger) Debugf(format string, v ...interface{}) {
	if s.level <= core.LOG_DEBUG {
		s.DEBUG.Output(2, fmt.Sprintf(format, v...))
	}
}

// Info implement core.ILogger
func (s *SimpleLogger) Info(v ...interface{}) {
	if s.level <= core.LOG_INFO {
		s.INFO.Output(2, fmt.Sprint(v...))
	}
}

// Infof implement core.ILogger
func (s *SimpleLogger) Infof(format string, v ...interface{}) {
	if s.level <= core.LOG_INFO {
		s.INFO.Output(2, fmt.Sprintf(format, v...))
	}
}

// Warn implement core.ILogger
func (s *SimpleLogger) Warn(v ...interface{}) {
	if s.level <= core.LOG_WARNING {
		s.WARN.Output(2, fmt.Sprint(v...))
	}
}

// Warnf implement core.ILogger
func (s *SimpleLogger) Warnf(format string, v ...interface{}) {
	if s.level <= core.LOG_WARNING {
		s.WARN.Output(2, fmt.Sprintf(format, v...))
	}
}

// Level implement core.ILogger
func (s *SimpleLogger) Level() core.LogLevel {
	return s.level
}

// SetLevel implement core.ILogger
func (s *SimpleLogger) SetLevel(l core.LogLevel) {
	s.level = l
}

// ShowSQL implement core.ILogger
func (s *SimpleLogger) ShowSQL(show ...bool) {
	if len(show) == 0 {
		s.showSQL = true
		return
	}
	s.showSQL = show[0]
}

// IsShowSQL implement core.ILogger
func (s *SimpleLogger) IsShowSQL() bool {
	return s.showSQL
}
