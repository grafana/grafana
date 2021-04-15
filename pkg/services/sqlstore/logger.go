package sqlstore

import (
	"fmt"

	glog "github.com/grafana/grafana/pkg/infra/log"

	xormlog "xorm.io/xorm/log"
)

type XormLogger struct {
	grafanaLog glog.Logger
	level      glog.Lvl
	showSQL    bool
}

func NewXormLogger(level glog.Lvl, grafanaLog glog.Logger) *XormLogger {
	return &XormLogger{
		grafanaLog: grafanaLog,
		level:      level,
		showSQL:    true,
	}
}

// Error implement xormlog.ILogger
func (s *XormLogger) Error(v ...interface{}) {
	if s.level <= glog.LvlError {
		s.grafanaLog.Error(fmt.Sprint(v...))
	}
}

// Errorf implement xormlog.ILogger
func (s *XormLogger) Errorf(format string, v ...interface{}) {
	if s.level <= glog.LvlError {
		s.grafanaLog.Error(fmt.Sprintf(format, v...))
	}
}

// Debug implement xormlog.ILogger
func (s *XormLogger) Debug(v ...interface{}) {
	if s.level <= glog.LvlDebug {
		s.grafanaLog.Debug(fmt.Sprint(v...))
	}
}

// Debugf implement xormlog.ILogger
func (s *XormLogger) Debugf(format string, v ...interface{}) {
	if s.level <= glog.LvlDebug {
		s.grafanaLog.Debug(fmt.Sprintf(format, v...))
	}
}

// Info implement xormlog.ILogger
func (s *XormLogger) Info(v ...interface{}) {
	if s.level <= glog.LvlInfo {
		s.grafanaLog.Info(fmt.Sprint(v...))
	}
}

// Infof implement xormlog.ILogger
func (s *XormLogger) Infof(format string, v ...interface{}) {
	if s.level <= glog.LvlInfo {
		s.grafanaLog.Info(fmt.Sprintf(format, v...))
	}
}

// Warn implement xormlog.ILogger
func (s *XormLogger) Warn(v ...interface{}) {
	if s.level <= glog.LvlWarn {
		s.grafanaLog.Warn(fmt.Sprint(v...))
	}
}

// Warnf implement xormlog.ILogger
func (s *XormLogger) Warnf(format string, v ...interface{}) {
	if s.level <= glog.LvlWarn {
		s.grafanaLog.Warn(fmt.Sprintf(format, v...))
	}
}

// Level implement xormlog.ILogger
func (s *XormLogger) Level() xormlog.LogLevel {
	switch s.level {
	case glog.LvlError:
		return xormlog.LOG_ERR
	case glog.LvlWarn:
		return xormlog.LOG_WARNING
	case glog.LvlInfo:
		return xormlog.LOG_INFO
	case glog.LvlDebug:
		return xormlog.LOG_DEBUG
	default:
		return xormlog.LOG_ERR
	}
}

// SetLevel implement xormlog.ILogger
func (s *XormLogger) SetLevel(l xormlog.LogLevel) {
}

// ShowSQL implement xormlog.ILogger
func (s *XormLogger) ShowSQL(show ...bool) {
	s.grafanaLog.Error("ShowSQL", "show", "show")
	if len(show) == 0 {
		s.showSQL = true
		return
	}
	s.showSQL = show[0]
}

// IsShowSQL implement xormlog.ILogger
func (s *XormLogger) IsShowSQL() bool {
	return s.showSQL
}
