//go:build windows
// +build windows

package log

import (
	"github.com/go-kit/log"
	"gopkg.in/ini.v1"
)

type SysLogHandler struct {
	logger log.Logger
}

func NewSyslog(sec *ini.Section, format Formatedlogger) *SysLogHandler {
	return &SysLogHandler{}
}

func (sw *SysLogHandler) Log(keyvals ...interface{}) error {
	return nil
}

func (sw *SysLogHandler) Close() error {
	return nil
}
