package log

import gokitlog "github.com/go-kit/log"

type compositeLogger struct {
	loggers []gokitlog.Logger
}

func newCompositeLogger(loggers ...gokitlog.Logger) *compositeLogger {
	if len(loggers) == 0 {
		loggers = []gokitlog.Logger{}
	}

	return &compositeLogger{loggers: loggers}
}

func (l *compositeLogger) Log(keyvals ...interface{}) error {
	for _, logger := range l.loggers {
		if err := logger.Log(keyvals...); err != nil {
			return err
		}
	}

	return nil
}
