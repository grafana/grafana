package logging

import (
	"strings"

	"github.com/go-kit/log/level"

	glog "github.com/grafana/grafana/pkg/infra/log"
)

// GoKitWrapper wraps around the grafana-specific logger to make a compatible logger for go-kit.
type GoKitWrapper struct {
	logger glog.Logger
}

// NewWrapper creates a new go-kit wrapper for a grafana-specific logger
func NewWrapper(l glog.Logger) *GoKitWrapper {
	return &GoKitWrapper{logger: l}
}

// Write implements io.Writer
func (w *GoKitWrapper) Write(p []byte) (n int, err error) {
	withoutNewline := strings.TrimSuffix(string(p), "\n")
	w.logger.Info(withoutNewline)
	return len(p), nil
}

// Log implements interface go-kit/log/Logger. It tries to extract level and message from the context and writes to underlying message.
// To successfully extract the log level, the first pair of elements should be 'lvl' and log level. Otherwise, it falls back to info.
// The following pair should be 'msg' and message. Otherwise, it uses the empty string as message.
func (w *GoKitWrapper) Log(keyvals ...interface{}) error {
	if len(keyvals) == 0 {
		return nil
	}

	f := w.logger.Info
	startwith := 0
	if keyvals[0] == level.Key() {
		startwith = 2
		switch keyvals[1] {
		case level.DebugValue():
			f = w.logger.Debug
		case level.InfoValue():
			f = w.logger.Info
		case level.WarnValue():
			f = w.logger.Warn
		case level.ErrorValue():
			f = w.logger.Error
		}
	}

	msg := ""
	if keyvals[startwith] == "msg" {
		str, ok := keyvals[startwith+1].(string)
		if ok {
			msg = str
			startwith += 2
		}
	}

	f(msg, keyvals[startwith:]...)
	return nil
}
