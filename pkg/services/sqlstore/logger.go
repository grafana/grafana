package sqlstore

import (
	"fmt"

	glog "github.com/grafana/grafana/pkg/log"

	"github.com/go-xorm/core"
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

// Error implement core.ILogger
func (s *XormLogger) Err(v ...interface{}) error {
	if s.level <= glog.LvlError {
		s.grafanaLog.Error(fmt.Sprint(v...))
	}
	return nil
}

// Errorf implement core.ILogger
func (s *XormLogger) Errf(format string, v ...interface{}) error {
	if s.level <= glog.LvlError {
		s.grafanaLog.Error(fmt.Sprintf(format, v...))
	}
	return nil
}

// Debug implement core.ILogger
func (s *XormLogger) Debug(v ...interface{}) error {
	if s.level <= glog.LvlDebug {
		s.grafanaLog.Debug(fmt.Sprint(v...))
	}
	return nil
}

// Debugf implement core.ILogger
func (s *XormLogger) Debugf(format string, v ...interface{}) error {
	if s.level <= glog.LvlDebug {
		s.grafanaLog.Debug(fmt.Sprintf(format, v...))
	}
	return nil
}

// Info implement core.ILogger
func (s *XormLogger) Info(v ...interface{}) error {
	if s.level <= glog.LvlInfo {
		s.grafanaLog.Info(fmt.Sprint(v...))
	}
	return nil
}

// Infof implement core.ILogger
func (s *XormLogger) Infof(format string, v ...interface{}) error {
	if s.level <= glog.LvlInfo {
		s.grafanaLog.Info(fmt.Sprintf(format, v...))
	}
	return nil
}

// Warn implement core.ILogger
func (s *XormLogger) Warning(v ...interface{}) error {
	if s.level <= glog.LvlWarn {
		s.grafanaLog.Warn(fmt.Sprint(v...))
	}
	return nil
}

// Warnf implement core.ILogger
func (s *XormLogger) Warningf(format string, v ...interface{}) error {
	if s.level <= glog.LvlWarn {
		s.grafanaLog.Warn(fmt.Sprintf(format, v...))
	}
	return nil
}

// Level implement core.ILogger
func (s *XormLogger) Level() core.LogLevel {
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
func (s *XormLogger) SetLevel(l core.LogLevel) error {
	return nil
}

// ShowSQL implement core.ILogger
func (s *XormLogger) ShowSQL(show ...bool) {
	s.grafanaLog.Error("ShowSQL", "show", "show")
	if len(show) == 0 {
		s.showSQL = true
		return
	}
	s.showSQL = show[0]
}

// IsShowSQL implement core.ILogger
func (s *XormLogger) IsShowSQL() bool {
	return s.showSQL
}
