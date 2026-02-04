package logutil

import (
	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
	"github.com/grafana/grafana-app-sdk/logging"
)

func ToGoKitLogger(logger logging.Logger) log.Logger {
	return &sdk2gkLogger{logger: logger}
}

type sdk2gkLogger struct {
	logger logging.Logger
}

func (s *sdk2gkLogger) Log(keyvals ...interface{}) error {
	var (
		outMsg     = ""
		outLevel   = interface{}(level.InfoValue())
		outKeyvals = []interface{}{}
	)

	if len(keyvals) == 0 {
		s.logger.Info("")
		return nil
	}

	if len(keyvals)%2 == 1 {
		keyvals = append(keyvals, nil)
	}

	for i := 0; i < len(keyvals); i += 2 {
		k, v := keyvals[i], keyvals[i+1]

		if keyvals[i] == "msg" {
			outMsg = v.(string)
			continue
		}

		if k == level.Key() {
			outLevel = v
			continue
		}

		outKeyvals = append(outKeyvals, k)
		outKeyvals = append(outKeyvals, v)
	}

	switch outLevel {
	case level.DebugValue():
		s.logger.Debug(outMsg, outKeyvals...)
	case level.InfoValue():
		s.logger.Info(outMsg, outKeyvals...)
	case level.WarnValue():
		s.logger.Warn(outMsg, outKeyvals...)
	case level.ErrorValue():
		s.logger.Error(outMsg, outKeyvals...)
	}

	return nil
}
