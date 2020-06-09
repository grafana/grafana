package sqlstore

import (
	"fmt"

	glog "github.com/grafana/grafana/pkg/infra/log"

	"xorm.io/xorm/log"
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

// Error implement log.Logger
func (s *XormLogger) Error(v ...interface{}) {
	if s.level <= glog.LvlError {
		s.grafanaLog.Error(fmt.Sprint(v...))
	}
}

// Errorf implement log.Logger
func (s *XormLogger) Errorf(format string, v ...interface{}) {
	if s.level <= glog.LvlError {
		s.grafanaLog.Error(fmt.Sprintf(format, v...))
	}
}

// Debug implement log.Logger
func (s *XormLogger) Debug(v ...interface{}) {
	if s.level <= glog.LvlDebug {
		s.grafanaLog.Debug(fmt.Sprint(v...))
	}
}

// Debugf implement log.Logger
func (s *XormLogger) Debugf(format string, v ...interface{}) {
	if s.level <= glog.LvlDebug {
		s.grafanaLog.Debug(fmt.Sprintf(format, v...))
	}
}

// Info implement log.Logger
func (s *XormLogger) Info(v ...interface{}) {
	if s.level <= glog.LvlInfo {
		s.grafanaLog.Info(fmt.Sprint(v...))
	}
}

// Infof implement log.Logger
func (s *XormLogger) Infof(format string, v ...interface{}) {
	if s.level <= glog.LvlInfo {
		s.grafanaLog.Info(fmt.Sprintf(format, v...))
	}
}

// Warn implement log.Logger
func (s *XormLogger) Warn(v ...interface{}) {
	if s.level <= glog.LvlWarn {
		s.grafanaLog.Warn(fmt.Sprint(v...))
	}
}

// Warnf implement log.Logger
func (s *XormLogger) Warnf(format string, v ...interface{}) {
	if s.level <= glog.LvlWarn {
		s.grafanaLog.Warn(fmt.Sprintf(format, v...))
	}
}

// Level implement log.Logger
func (s *XormLogger) Level() log.LogLevel {
	switch s.level {
	case glog.LvlError:
		return log.LOG_ERR
	case glog.LvlWarn:
		return log.LOG_WARNING
	case glog.LvlInfo:
		return log.LOG_INFO
	case glog.LvlDebug:
		return log.LOG_DEBUG
	default:
		return log.LOG_ERR
	}
}

// SetLevel implement log.Logger
func (s *XormLogger) SetLevel(l log.LogLevel) {
}

// ShowSQL implement log.Logger
func (s *XormLogger) ShowSQL(show ...bool) {
	s.grafanaLog.Error("ShowSQL", "show", "show")
	if len(show) == 0 {
		s.showSQL = true
		return
	}
	s.showSQL = show[0]
}

// IsShowSQL implement log.Logger
func (s *XormLogger) IsShowSQL() bool {
	return s.showSQL
}
