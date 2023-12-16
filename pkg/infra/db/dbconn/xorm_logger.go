package dbconn

import (
	"fmt"

	glog "github.com/grafana/grafana/pkg/infra/log"

	"xorm.io/core"
)

type xormLogger struct {
	grafanaLog glog.Logger
	level      glog.Lvl
	showSQL    bool
}

func newXormLogger(level glog.Lvl, grafanaLog glog.Logger) *xormLogger {
	return &xormLogger{
		grafanaLog: grafanaLog,
		level:      level,
		showSQL:    true,
	}
}

// Error implement core.ILogger
func (s *xormLogger) Error(v ...any) {
	if s.level <= glog.LvlError {
		s.grafanaLog.Error(fmt.Sprint(v...))
	}
}

// Errorf implement core.ILogger
func (s *xormLogger) Errorf(format string, v ...any) {
	if s.level <= glog.LvlError {
		s.grafanaLog.Error(fmt.Sprintf(format, v...))
	}
}

// Debug implement core.ILogger
func (s *xormLogger) Debug(v ...any) {
	if s.level <= glog.LvlDebug {
		s.grafanaLog.Debug(fmt.Sprint(v...))
	}
}

// Debugf implement core.ILogger
func (s *xormLogger) Debugf(format string, v ...any) {
	if s.level <= glog.LvlDebug {
		s.grafanaLog.Debug(fmt.Sprintf(format, v...))
	}
}

// Info implement core.ILogger
func (s *xormLogger) Info(v ...any) {
	if s.level <= glog.LvlInfo {
		s.grafanaLog.Info(fmt.Sprint(v...))
	}
}

// Infof implement core.ILogger
func (s *xormLogger) Infof(format string, v ...any) {
	if s.level <= glog.LvlInfo {
		s.grafanaLog.Info(fmt.Sprintf(format, v...))
	}
}

// Warn implement core.ILogger
func (s *xormLogger) Warn(v ...any) {
	if s.level <= glog.LvlWarn {
		s.grafanaLog.Warn(fmt.Sprint(v...))
	}
}

// Warnf implement core.ILogger
func (s *xormLogger) Warnf(format string, v ...any) {
	if s.level <= glog.LvlWarn {
		s.grafanaLog.Warn(fmt.Sprintf(format, v...))
	}
}

// Level implement core.ILogger
func (s *xormLogger) Level() core.LogLevel {
	switch s.level {
	case glog.LvlError:
		return core.LOG_ERR
	case glog.LvlWarn:
		return core.LOG_WARNING
	case glog.LvlInfo:
		return core.LOG_INFO
	case glog.LvlDebug:
		return core.LOG_DEBUG
	default:
		return core.LOG_ERR
	}
}

// SetLevel implement core.ILogger
func (s *xormLogger) SetLevel(l core.LogLevel) {
}

// ShowSQL implement core.ILogger
func (s *xormLogger) ShowSQL(show ...bool) {
	if len(show) == 0 {
		s.showSQL = true
		return
	}
	s.showSQL = show[0]
}

// IsShowSQL implement core.ILogger
func (s *xormLogger) IsShowSQL() bool {
	return s.showSQL
}
