package sqlstore

import (
	"fmt"

	"xorm.io/xorm/log"
)

type XormContextLogger struct {
	logger *XormLogger
}

var (
	_ log.ContextLogger = &XormContextLogger{}
)

func NewXormContextLogger(logger *XormLogger) *XormContextLogger {
	return &XormContextLogger{
		logger: logger,
	}
}

// BeforeSQL implements log.ContextLogger
func (l *XormContextLogger) BeforeSQL(ctx log.LogContext) {}

// AfterSQL implements log.ContextLogger
func (l *XormContextLogger) AfterSQL(ctx log.LogContext) {
	fmt.Printf("CALLED")
	if ctx.ExecuteTime > 0 {
		l.logger.grafanaLog.Info("SQL Query", "SQL", ctx.SQL, "args", ctx.Args, "took", ctx.ExecuteTime)
	} else {
		l.logger.grafanaLog.Info("SQL Query", "SQL", ctx.SQL, "args", ctx.Args)
	}
}

// Debugf implement log.ContextLogger
func (l *XormContextLogger) Debugf(s string, v ...interface{}) {
	l.logger.Debugf(s, v...)
}

// Errorf implement log.ContextLogger
func (l *XormContextLogger) Errorf(s string, v ...interface{}) {
	l.logger.Errorf(s, v...)
}

// Infof implement log.ContextLogger
func (l *XormContextLogger) Infof(s string, v ...interface{}) {
	l.logger.Infof(s, v...)
}

// Warnf implement log.ContextLogger
func (l *XormContextLogger) Warnf(s string, v ...interface{}) {
	l.logger.Warnf(s, v...)
}

// Level implement log.ContextLogger
func (l *XormContextLogger) Level() log.LogLevel {
	return l.logger.Level()
}

// SetLevel implement log.ContextLogger
func (l *XormContextLogger) SetLevel(lvl log.LogLevel) {
	l.logger.SetLevel(lvl)
}

// ShowSQL implement log.ContextLogger
func (l *XormContextLogger) ShowSQL(show ...bool) {
	l.logger.ShowSQL()
}

// IsShowSQL implement log.ContextLogger
func (l *XormContextLogger) IsShowSQL() bool {
	return l.logger.IsShowSQL()
}
