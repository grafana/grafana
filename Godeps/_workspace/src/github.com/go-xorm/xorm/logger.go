package xorm

import (
	"fmt"
	"io"
	"log"

	"github.com/go-xorm/core"
)

const (
	DEFAULT_LOG_PREFIX = "[xorm]"
	DEFAULT_LOG_FLAG   = log.Ldate | log.Lmicroseconds
	DEFAULT_LOG_LEVEL  = core.LOG_DEBUG
)

type SimpleLogger struct {
	DEBUG *log.Logger
	ERR   *log.Logger
	INFO  *log.Logger
	WARN  *log.Logger
	level core.LogLevel
}

func NewSimpleLogger(out io.Writer) *SimpleLogger {
	return NewSimpleLogger2(out, DEFAULT_LOG_PREFIX, DEFAULT_LOG_FLAG)
}

func NewSimpleLogger2(out io.Writer, prefix string, flag int) *SimpleLogger {
	return NewSimpleLogger3(out, prefix, flag, DEFAULT_LOG_LEVEL)
}

func NewSimpleLogger3(out io.Writer, prefix string, flag int, l core.LogLevel) *SimpleLogger {
	return &SimpleLogger{
		DEBUG: log.New(out, fmt.Sprintf("%s [debug] ", prefix), flag),
		ERR:   log.New(out, fmt.Sprintf("%s [error] ", prefix), flag),
		INFO:  log.New(out, fmt.Sprintf("%s [info]  ", prefix), flag),
		WARN:  log.New(out, fmt.Sprintf("%s [warn]  ", prefix), flag),
		level: l,
	}
}

func (s *SimpleLogger) Err(v ...interface{}) (err error) {
	if s.level > core.LOG_OFF && s.level <= core.LOG_ERR {
		s.ERR.Println(v...)
	}
	return
}

func (s *SimpleLogger) Errf(format string, v ...interface{}) (err error) {
	if s.level > core.LOG_OFF && s.level <= core.LOG_ERR {
		s.ERR.Printf(format, v...)
	}
	return
}

func (s *SimpleLogger) Debug(v ...interface{}) (err error) {
	if s.level > core.LOG_OFF && s.level <= core.LOG_DEBUG {
		s.DEBUG.Println(v...)
	}
	return
}

func (s *SimpleLogger) Debugf(format string, v ...interface{}) (err error) {
	if s.level > core.LOG_OFF && s.level >= core.LOG_DEBUG {
		s.DEBUG.Printf(format, v...)
	}
	return
}

func (s *SimpleLogger) Info(v ...interface{}) (err error) {
	if s.level > core.LOG_OFF && s.level >= core.LOG_INFO {
		s.INFO.Println(v...)
	}
	return
}

func (s *SimpleLogger) Infof(format string, v ...interface{}) (err error) {
	if s.level > core.LOG_OFF && s.level >= core.LOG_INFO {
		s.INFO.Printf(format, v...)
	}
	return
}

func (s *SimpleLogger) Warning(v ...interface{}) (err error) {
	if s.level > core.LOG_OFF && s.level >= core.LOG_WARNING {
		s.WARN.Println(v...)
	}
	return
}

func (s *SimpleLogger) Warningf(format string, v ...interface{}) (err error) {
	if s.level > core.LOG_OFF && s.level >= core.LOG_WARNING {
		s.WARN.Printf(format, v...)
	}
	return
}

func (s *SimpleLogger) Level() core.LogLevel {
	return s.level
}

func (s *SimpleLogger) SetLevel(l core.LogLevel) (err error) {
	s.level = l
	return
}
